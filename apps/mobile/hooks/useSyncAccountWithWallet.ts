import { type BdkWallet } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'

import { syncWallet } from '@/api/bdk'
import { getWalletOverview, revealKnownAddresses } from '@/api/bdkWalletMappers'
import { syncWithCoreWallet } from '@/api/coreWalletSync'
import { ElectrumUnreachableError } from '@/api/electrumReachability'
import BitcoinRpc from '@/api/rpc'
import {
  CORE_NODE_WAIT_HEARTBEAT_MS,
  SUPERSEDED_SYNC_WAIT_TIMEOUT_MS,
  SYNC_CANCELLED_ERROR,
  SYNC_PRICE_LOOKUP_TIMEOUT_MS
} from '@/constants/sync'
import { markServerConnectionFailed } from '@/hooks/useVerifyConnection'
import { t } from '@/locales'
import { type SyncTaskControls, SyncTimeoutError } from '@/services/syncQueue'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { type Account, type SyncProgress } from '@/types/models/Account'
import { type Prices } from '@/types/models/Blockchain'
import { type Config, type Server } from '@/types/settings/blockchain'
import { updateAccountObjectLabels } from '@/utils/account'
import { getSyncStallTimeoutMs, shouldFullScan } from '@/utils/accountSync'
import {
  cancelAccountSync,
  hasCurrentSyncRun,
  isCoreNodeBusy,
  runExclusiveOnCoreNode,
  settleCancelledSyncStatus,
  trackAccountSyncWork,
  waitForAccountSyncWork,
  walletSyncQueue,
  writeSyncStatus
} from '@/utils/accountSyncRuns'
import { walletForServerChain } from '@/utils/accountWallets'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { formatTimestamp } from '@/utils/format'
import { parseAccountAddressesDetails } from '@/utils/parse'
import { resolveHistoricalPrices } from '@/utils/resolveHistoricalPrices'
import { isSameServerEndpoint } from '@/utils/server'
import {
  type SyncErrorReporter,
  reportSyncFailure
} from '@/utils/syncFailureToasts'
import { withTimeout } from '@/utils/time'
import { reconcileTransactions } from '@/utils/transaction'

type WalletSyncParams = Pick<
  ReturnType<typeof useAccountsStore.getState>,
  'setSyncProgress' | 'setSyncStatus'
> &
  Pick<
    ReturnType<typeof useBlockchainStore.getState>,
    'lastKnownBlockHeight' | 'setLastKnownBlockHeight'
  > & {
    config: Config
    controls: SyncTaskControls
    forceFullScan: boolean
    latest: Account
    server: Server
    wallet: BdkWallet
  }

async function syncWalletAccount({
  config,
  controls,
  forceFullScan,
  lastKnownBlockHeight,
  latest,
  server,
  setLastKnownBlockHeight,
  setSyncProgress: storeSyncProgress,
  setSyncStatus,
  wallet
}: WalletSyncParams): Promise<Account | null> {
  const { finishScan, reportProgress, signal } = controls
  setSyncStatus(latest.id, 'syncing')

  const lastProgress = { tasksDone: -1 }
  function setSyncProgress(id: string, progress: SyncProgress) {
    // A replaced sync must not overwrite the new one's progress.
    if (signal.aborted) {
      return
    }
    // Only real advancement keeps a sync alive: Core can report the same
    // rescan height for as long as it is stuck.
    if (progress.tasksDone !== lastProgress.tasksDone) {
      lastProgress.tasksDone = progress.tasksDone
      reportProgress()
    }
    storeSyncProgress(id, progress)
  }

  const checkpoint = wallet.latestCheckpoint()
  const switchingFromRpc = server.backend !== 'rpc' && !!latest.rpcLastBlockHash
  const isFullScan = shouldFullScan({
    account: latest,
    checkpoint,
    forceFullScan
  })
  const isGeneratedWallet = latest.keys[0]?.creationType === 'generateMnemonic'

  // If the store tip isn't ready yet, ask the node directly so the
  // birthday estimate and scan range are always correct.
  let tip: number | undefined =
    lastKnownBlockHeight > 0 ? lastKnownBlockHeight : undefined
  if (!tip && server.backend === 'rpc' && server.url) {
    try {
      const rpc = new BitcoinRpc(
        server.url,
        server.rpcCredentials?.username ?? '',
        server.rpcCredentials?.password ?? ''
      )
      tip = await rpc.getBlockCount()
      setLastKnownBlockHeight(tip)
    } catch {
      // non-critical — sync will fall back to checkpointHeight
    }
  }

  // Birthday for scan purposes:
  // - Generated wallets: createdAt IS the real birthday (wallet was just made)
  // - Imported wallets:  only the user-set birthdayDate counts;
  //                      createdAt is just the app import date — useless as scan floor
  const effectiveBirthday = isGeneratedWallet
    ? latest.createdAt
    : (latest.birthdayDate ?? undefined)

  // RPC backend always uses the Bitcoin Core wallet path (importdescriptors +
  // rescanblockchain + listtransactions) — the same approach as Sparrow Wallet.
  // Compact block filters are not used for RPC.
  const useCoreWallet = usesCoreWallet(server)

  let walletSummary: ReturnType<typeof getWalletOverview>
  let newRpcLastBlockHash: string | undefined

  if (useCoreWallet && server.rpcCredentials) {
    // Start indeterminate; block-count progress only exists during a full
    // rescan. Incremental syncs (listsinceblock) have no scan phase, so
    // this stays indeterminate rather than showing a misleading 100%.
    setSyncProgress(latest.id, { tasksDone: 0, totalTasks: 0 })
    const coreResult = await syncWithCoreWallet(
      latest,
      wallet,
      server.url,
      server.rpcCredentials,
      appNetworkToBdkNetwork(server.network),
      config.stopGap,
      (currentHeight, tipHeight, meta) => {
        setSyncProgress(latest.id, {
          currentBlockTimeSec: meta?.currentBlockTimeSec,
          scanFromTimeSec: meta?.scanFromTimeSec,
          tasksDone: currentHeight,
          totalTasks: tipHeight,
          transactionsFound: meta?.transactionsFound
        })
      },
      () => signal.aborted,
      server.rpcWalletName,
      server.rpcScanFromHeight
    )
    walletSummary = coreResult
    newRpcLastBlockHash = coreResult.rpcLastBlockHash
  } else {
    const scanWallet = await walletForServerChain(latest, wallet, server)
    // A wallet replaced for another chain starts empty: find all its history.
    const isScanFull = isFullScan || scanWallet !== wallet
    if (!isScanFull) {
      revealKnownAddresses(scanWallet, latest, config.stopGap)
    }
    await syncWallet(
      scanWallet,
      server.backend,
      server.url,
      config.stopGap,
      isScanFull,
      server.rpcCredentials,
      effectiveBirthday,
      tip,
      server.rpcScanFromHeight,
      isGeneratedWallet,
      {
        onProgress: (tasksDone, totalTasks) =>
          setSyncProgress(latest.id, { tasksDone, totalTasks }),
        signal
      }
    )

    const latestCheckpoint = scanWallet.latestCheckpoint()
    if (latestCheckpoint) {
      setLastKnownBlockHeight(latestCheckpoint.height)
    }

    walletSummary = getWalletOverview(
      scanWallet,
      appNetworkToBdkNetwork(server.network),
      config.stopGap
    )
  }

  // Cancelled or timed out during the (potentially long) sync call: the
  // queue has already moved on, so discard the result.
  if (signal.aborted) {
    return null
  }
  finishScan()

  // Capture cached prices before overwriting transactions with fresh BDK data
  const cachedPrices: Record<string, Prices> = {}
  for (const tx of latest.transactions) {
    if (tx.prices && Object.keys(tx.prices).length > 0) {
      cachedPrices[tx.id] = tx.prices
    }
  }

  let updatedAccount: Account = {
    ...latest,
    addresses: walletSummary.addresses,
    summary: walletSummary.summary,
    transactions: walletSummary.transactions,
    utxos: walletSummary.utxos
  }

  if (newRpcLastBlockHash) {
    updatedAccount.rpcLastBlockHash = newRpcLastBlockHash
  }

  updatedAccount.addresses = parseAccountAddressesDetails(updatedAccount)
  updatedAccount = updateAccountObjectLabels(updatedAccount)

  const { fiatCurrency } = usePriceStore.getState()

  // Apply cached prices and collect timestamps only for unpriced transactions
  const unpricedTimestamps: number[] = []
  for (const tx of updatedAccount.transactions) {
    const cached = cachedPrices[tx.id]
    if (cached !== undefined) {
      tx.prices = { ...cached }
    }
    if (tx.prices?.[fiatCurrency] !== undefined || !tx.timestamp) {
      continue
    }
    unpricedTimestamps.push(formatTimestamp(tx.timestamp))
  }

  if (unpricedTimestamps.length > 0) {
    const uniqueTimestamps = [...new Set(unpricedTimestamps)]
    try {
      // Bounded so a slow price API can't hold the sync slot or the result.
      const priceMap = await withTimeout(
        resolveHistoricalPrices(fiatCurrency, uniqueTimestamps),
        SYNC_PRICE_LOOKUP_TIMEOUT_MS
      )
      for (const tx of updatedAccount.transactions) {
        if (tx.prices?.[fiatCurrency] !== undefined || !tx.timestamp) {
          continue
        }
        const price = priceMap[formatTimestamp(tx.timestamp)]
        if (price !== undefined) {
          tx.prices = { ...tx.prices, [fiatCurrency]: price }
        }
      }
    } catch {
      toast.error(t('account.sync.historicalPricesFailed'))
    }
  }

  // Reuse prior object references for transactions that did not change,
  // so the transaction list only re-renders rows that actually differ.
  updatedAccount.transactions = reconcileTransactions(
    latest.transactions,
    updatedAccount.transactions
  )

  updatedAccount.syncStatus = 'synced'
  updatedAccount.lastSyncedAt = new Date()

  // After a successful Electrum/Esplora sync, clear rpcLastBlockHash
  // so returning to RPC can still use listsinceblock from a fresh tip.
  if (switchingFromRpc) {
    updatedAccount.rpcLastBlockHash = undefined
  }

  return updatedAccount
}

function handleSyncError(
  account: Account,
  error: unknown,
  reportError: SyncErrorReporter
): Account | null {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg === SYNC_CANCELLED_ERROR) {
    settleCancelledSyncStatus(account.id)
    return null
  }

  if (error instanceof ElectrumUnreachableError) {
    void markServerConnectionFailed(error.url)
  }
  const syncStatus = error instanceof SyncTimeoutError ? 'timeout' : 'error'
  writeSyncStatus(account.id, syncStatus)
  const latest =
    useAccountsStore.getState().accounts.find((a) => a.id === account.id) ??
    account
  reportError(latest.name ?? latest.id, error)
  return { ...latest, syncStatus }
}

async function runQueuedWalletSync(
  account: Account,
  wallet: BdkWallet,
  forceFullScan: boolean,
  controls: SyncTaskControls
): Promise<Account | null> {
  // A cancelled or stalled sync of this account may still be inside the
  // native call; never run two. Bounded, so one stuck on a dead server can't
  // hold this account forever.
  const earlierSyncSettled = await waitForAccountSyncWork(
    account.id,
    SUPERSEDED_SYNC_WAIT_TIMEOUT_MS
  )
  if (!earlierSyncSettled) {
    throw new Error(t('account.sync.earlierSyncStuck'))
  }
  if (controls.signal.aborted) {
    return null
  }

  const target = resolveSyncTarget(account.id, controls.isPriority)
  if (!target) {
    return null
  }
  return runOnCoreNodeExclusively(account.id, target.server, controls, () => {
    // Waiting behind another account's Core sync can take hours: the server
    // or the connection mode may have changed since.
    const current = resolveSyncTarget(account.id, controls.isPriority)
    if (!current || !isSameServerEndpoint(current.server, target.server)) {
      return Promise.resolve(null)
    }
    return trackAccountSyncWork(
      account.id,
      syncWalletAccount({ ...current, controls, forceFullScan, wallet })
    )
  })
}

type SyncTarget = Omit<
  WalletSyncParams,
  'controls' | 'forceFullScan' | 'wallet'
>

/**
 * What a job syncs with, read when it is about to run rather than when it was
 * queued: the server or stop gap may have changed while it waited (or a
 * backup restore just replaced them). Null when the job must not run.
 */
function resolveSyncTarget(
  accountId: string,
  isPriority: boolean
): SyncTarget | null {
  const {
    configs,
    lastKnownBlockHeight,
    selectedNetwork,
    setLastKnownBlockHeight
  } = useBlockchainStore.getState()
  const { server, config } = configs[selectedNetwork]
  const { accounts, setSyncProgress, setSyncStatus } =
    useAccountsStore.getState()
  const latest = accounts.find((a) => a.id === accountId)
  // Deleted while it waited, or the user switched networks: this server must
  // not receive the account's descriptors.
  if (!latest || latest.network !== selectedNetwork) {
    return null
  }
  // The user turned automatic syncing off while this background job waited.
  if (!isPriority && config.connectionMode === 'manual') {
    return null
  }
  return {
    config,
    lastKnownBlockHeight,
    latest,
    server,
    setLastKnownBlockHeight,
    setSyncProgress,
    setSyncStatus
  }
}

function usesCoreWallet(server: Server) {
  return server.backend === 'rpc' && !!server.rpcCredentials
}

/**
 * Bitcoin Core wallet syncs to the same node run one at a time: accounts can
 * share a Core wallet, and the rescan one starts would abort another's.
 * Waiting behind another account's rescan is not a stall, so it keeps the job
 * alive, and the account shows as queued meanwhile.
 */
function runOnCoreNodeExclusively(
  accountId: string,
  server: Server,
  controls: SyncTaskControls,
  work: () => Promise<Account | null>
): Promise<Account | null> {
  if (!usesCoreWallet(server)) {
    return work()
  }
  if (isCoreNodeBusy(server.url)) {
    writeSyncStatus(accountId, 'queued')
  }
  const heartbeat = setInterval(
    controls.reportProgress,
    CORE_NODE_WAIT_HEARTBEAT_MS
  )
  controls.signal.addEventListener('abort', () => clearInterval(heartbeat))
  return runExclusiveOnCoreNode(server.url, () => {
    clearInterval(heartbeat)
    return controls.signal.aborted ? Promise.resolve(null) : work()
  })
}

type QueueWalletSyncParams = {
  account: Account
  forceFullScan: boolean
  isPriority: boolean
  reportError: SyncErrorReporter
  wallet: BdkWallet
}

/**
 * Queue a sync for this account. A second request for an account that is
 * already queued or syncing shares that job instead of starting another,
 * and resolves to null so callers don't write the same result twice.
 * `forceFullScan` replaces a running incremental sync. Never rejects.
 */
async function queueWalletSync({
  account,
  forceFullScan,
  isPriority,
  reportError,
  wallet
}: QueueWalletSyncParams): Promise<Account | null> {
  if (forceFullScan) {
    cancelAccountSync(account.id)
  }
  const isDuplicate = hasCurrentSyncRun(account.id)

  const outcome = await walletSyncQueue
    .enqueue(
      account.id,
      (controls) =>
        runQueuedWalletSync(account, wallet, forceFullScan, controls),
      {
        onQueued: () => writeSyncStatus(account.id, 'queued'),
        priority: isPriority,
        timeoutMs: () => {
          const { configs, selectedNetwork } = useBlockchainStore.getState()
          return getSyncStallTimeoutMs(configs[selectedNetwork].server)
        }
      }
    )
    .then(
      (value) => ({ value }),
      (error: unknown) => ({ error })
    )

  if ('error' in outcome) {
    return isDuplicate
      ? null
      : handleSyncError(account, outcome.error, reportError)
  }
  if (outcome.value === null) {
    settleCancelledSyncStatus(account.id)
  }
  return isDuplicate ? null : outcome.value
}

function useSyncAccountWithWallet() {
  function syncAccountWithWallet(
    account: Account,
    wallet: BdkWallet,
    forceFullScan = false,
    isPriority = false,
    reportError: SyncErrorReporter = reportSyncFailure
  ): Promise<Account | null> {
    return queueWalletSync({
      account,
      forceFullScan,
      isPriority,
      reportError,
      wallet
    })
  }

  return { syncAccountWithWallet }
}

export default useSyncAccountWithWallet
