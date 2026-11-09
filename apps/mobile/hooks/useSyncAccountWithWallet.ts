import { useState } from 'react'
import { type BdkWallet } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'

import { syncWallet } from '@/api/bdk'
import { getWalletOverview, revealKnownAddresses } from '@/api/bdkWalletMappers'
import { syncWithCoreWallet } from '@/api/coreWalletSync'
import BitcoinRpc from '@/api/rpc'
import {
  SUPERSEDED_SYNC_WAIT_TIMEOUT_MS,
  SYNC_CANCELLED_ERROR,
  SYNC_PRICE_LOOKUP_TIMEOUT_MS
} from '@/constants/sync'
import { t } from '@/locales'
import { type SyncTaskControls, SyncTimeoutError } from '@/services/syncQueue'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { type Account, type SyncProgress } from '@/types/models/Account'
import { type Prices } from '@/types/models/Blockchain'
import { type Config, type Server } from '@/types/settings/blockchain'
import { updateAccountObjectLabels } from '@/utils/account'
import {
  getSyncStallTimeoutMs,
  shouldFullScan,
  toRestoredSyncStatus
} from '@/utils/accountSync'
import {
  trackAccountSyncWork,
  waitForAccountSyncWork,
  walletSyncQueue
} from '@/utils/accountSyncRuns'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { formatTimestamp } from '@/utils/format'
import { parseAccountAddressesDetails } from '@/utils/parse'
import { resolveHistoricalPrices } from '@/utils/resolveHistoricalPrices'
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
  const useCoreWallet = server.backend === 'rpc' && !!server.rpcCredentials

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
    if (!isFullScan) {
      revealKnownAddresses(wallet, latest, config.stopGap)
    }
    await syncWallet(
      wallet,
      server.backend,
      server.url,
      config.stopGap,
      isFullScan,
      server.rpcCredentials,
      effectiveBirthday,
      tip,
      server.rpcScanFromHeight,
      isGeneratedWallet,
      server.backend === 'rpc'
        ? (current, tipHeight) => {
            setSyncProgress(latest.id, {
              tasksDone: current,
              totalTasks: tipHeight
            })
          }
        : undefined,
      {
        onScanProgress: (done, total) => {
          setSyncProgress(latest.id, { tasksDone: done, totalTasks: total })
        },
        signal
      }
    )

    const latestCheckpoint = wallet.latestCheckpoint()
    if (latestCheckpoint) {
      setLastKnownBlockHeight(latestCheckpoint.height)
    }

    walletSummary = getWalletOverview(
      wallet,
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

/**
 * The status shown on the account card. A failed write (SQLite) must not turn
 * a finished sync into a rejected one that callers don't expect.
 */
function writeSyncStatus(accountId: string, syncStatus: Account['syncStatus']) {
  try {
    useAccountsStore.getState().setSyncStatus(accountId, syncStatus)
  } catch {
    // the status stays stale until the next sync writes it
  }
}

function settleStatusAfterCancel(accountId: string) {
  if (walletSyncQueue.isActive(accountId)) {
    return
  }
  const current = useAccountsStore
    .getState()
    .accounts.find((a) => a.id === accountId)
  if (current?.syncStatus === 'syncing' || current?.syncStatus === 'queued') {
    writeSyncStatus(
      accountId,
      toRestoredSyncStatus(current.syncStatus, current.lastSyncedAt)
    )
  }
}

function handleSyncError(
  account: Account,
  error: unknown,
  reportError: SyncErrorReporter
): Account | null {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg === SYNC_CANCELLED_ERROR) {
    settleStatusAfterCancel(account.id)
    return null
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

  // Read when the job starts, not when it was queued: the server or stop gap
  // may have changed while it waited (or a backup restore just replaced them).
  const {
    configs,
    lastKnownBlockHeight,
    selectedNetwork,
    setLastKnownBlockHeight
  } = useBlockchainStore.getState()
  const { server, config } = configs[selectedNetwork]
  const { accounts, setSyncProgress, setSyncStatus } =
    useAccountsStore.getState()
  const latest = accounts.find((a) => a.id === account.id)
  // Deleted while it waited, or the user switched networks: this server must
  // not receive the account's descriptors.
  if (!latest || latest.network !== selectedNetwork) {
    return null
  }
  return trackAccountSyncWork(
    account.id,
    syncWalletAccount({
      config,
      controls,
      forceFullScan,
      lastKnownBlockHeight,
      latest,
      server,
      setLastKnownBlockHeight,
      setSyncProgress,
      setSyncStatus,
      wallet
    })
  )
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
    walletSyncQueue.cancel(account.id)
  }
  const isDuplicate = walletSyncQueue.isActive(account.id)
  const { configs, selectedNetwork } = useBlockchainStore.getState()

  const outcome = await walletSyncQueue
    .enqueue(
      account.id,
      (controls) =>
        runQueuedWalletSync(account, wallet, forceFullScan, controls),
      {
        onQueued: () => writeSyncStatus(account.id, 'queued'),
        priority: isPriority,
        timeoutMs: getSyncStallTimeoutMs(configs[selectedNetwork].server)
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
    settleStatusAfterCancel(account.id)
  }
  return isDuplicate ? null : outcome.value
}

function useSyncAccountWithWallet() {
  const [loading, setLoading] = useState(false)

  async function syncAccountWithWallet(
    account: Account,
    wallet: BdkWallet,
    forceFullScan = false,
    isPriority = false,
    reportError: SyncErrorReporter = reportSyncFailure
  ): Promise<Account | null> {
    setLoading(true)
    const result = await queueWalletSync({
      account,
      forceFullScan,
      isPriority,
      reportError,
      wallet
    })
    setLoading(false)
    return result
  }

  return { loading, syncAccountWithWallet }
}

export default useSyncAccountWithWallet
