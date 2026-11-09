import { useState } from 'react'
import { type BdkWallet } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { syncWallet } from '@/api/bdk'
import { getWalletOverview, revealKnownAddresses } from '@/api/bdkWalletMappers'
import { syncWithCoreWallet } from '@/api/coreWalletSync'
import BitcoinRpc from '@/api/rpc'
import {
  SUPERSEDED_SYNC_WAIT_TIMEOUT_MS,
  SYNC_CANCELLED_ERROR
} from '@/constants/sync'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { type Account } from '@/types/models/Account'
import { type Prices } from '@/types/models/Blockchain'
import { type Config, type Server } from '@/types/settings/blockchain'
import { updateAccountObjectLabels } from '@/utils/account'
import { shouldFullScan, toRestoredSyncStatus } from '@/utils/accountSync'
import {
  cancelAllAccountSyncs,
  hasCurrentSyncRun,
  isAccountSyncing,
  isPrioritySyncActiveFor,
  isSyncRunCurrent,
  releaseSyncRun,
  startSyncRun,
  trackAccountSyncWork,
  waitForAccountSyncWork
} from '@/utils/accountSyncRuns'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { formatTimestamp } from '@/utils/format'
import { parseAccountAddressesDetails } from '@/utils/parse'
import { resolveHistoricalPrices } from '@/utils/resolveHistoricalPrices'
import {
  type SyncErrorReporter,
  reportSyncFailure
} from '@/utils/syncFailureToasts'
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
    forceFullScan: boolean
    isCurrent: () => boolean
    latest: Account
    server: Server
    wallet: BdkWallet
  }

async function syncWalletAccount({
  config,
  forceFullScan,
  isCurrent,
  lastKnownBlockHeight,
  latest,
  server,
  setLastKnownBlockHeight,
  setSyncProgress,
  setSyncStatus,
  wallet
}: WalletSyncParams): Promise<Account | null> {
  setSyncStatus(latest.id, 'syncing')

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
      () => !isCurrent(),
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
        : undefined
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

  // Post-sync checkpoint: a run superseded or cancelled during the (possibly
  // long) sync call must not overwrite what a newer run may have written.
  if (!isCurrent()) {
    return null
  }

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
      const priceMap = await resolveHistoricalPrices(
        fiatCurrency,
        uniqueTimestamps
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

// A cancelled run settles the status from what was last synced, unless a
// newer run of the same account has taken over and owns the status now. The
// status it found may be another run's 'syncing', which nothing would clear.
function settleCancelledSync(
  latest: Account,
  setSyncStatus: WalletSyncParams['setSyncStatus']
) {
  if (hasCurrentSyncRun(latest.id)) {
    return
  }
  setSyncStatus(
    latest.id,
    toRestoredSyncStatus(latest.syncStatus, latest.lastSyncedAt) ?? 'unsynced'
  )
}

function failAccountSync(
  error: unknown,
  params: WalletSyncParams,
  reportError: SyncErrorReporter
): Account | null {
  const msg = error instanceof Error ? error.message : String(error)
  // Cancellation is not an error, so the UI must not turn red; neither is a
  // failure of a run a newer one already replaced.
  if (msg === SYNC_CANCELLED_ERROR || !params.isCurrent()) {
    settleCancelledSync(params.latest, params.setSyncStatus)
    return null
  }
  params.setSyncStatus(params.latest.id, 'error')
  reportError(params.latest.name ?? params.latest.id, error)
  // Callers write this back, so it must carry the error status.
  return { ...params.latest, syncStatus: 'error' }
}

/** Runs one sync to completion; never throws. */
async function runAccountSync(
  params: WalletSyncParams,
  runId: number,
  reportError: SyncErrorReporter
): Promise<Account | null> {
  try {
    const synced = await syncWalletAccount(params)
    if (!synced) {
      settleCancelledSync(params.latest, params.setSyncStatus)
    }
    return synced
  } catch (error) {
    return failAccountSync(error, params, reportError)
  } finally {
    releaseSyncRun(params.latest.id, runId)
  }
}

function useSyncAccountWithWallet() {
  const setSyncStatus = useAccountsStore((state) => state.setSyncStatus)
  const setSyncProgress = useAccountsStore((state) => state.setSyncProgress)

  const [
    selectedNetwork,
    configs,
    setLastKnownBlockHeight,
    lastKnownBlockHeight
  ] = useBlockchainStore(
    useShallow((state) => [
      state.selectedNetwork,
      state.configs,
      state.setLastKnownBlockHeight,
      state.lastKnownBlockHeight
    ])
  )
  const { server, config } = configs[selectedNetwork]

  const [loading, setLoading] = useState(false)

  // Cancels every running sync, including the account's own, so the priority
  // run that follows starts at once and is the only one allowed to write.
  function prioritizeSync() {
    cancelAllAccountSyncs()
  }

  async function syncAccountWithWallet(
    account: Account,
    wallet: BdkWallet,
    forceFullScan = false,
    isPriority = false,
    reportError: SyncErrorReporter = reportSyncFailure
  ): Promise<Account | null> {
    const latest =
      useAccountsStore.getState().accounts.find((a) => a.id === account.id) ??
      account

    // A background run yields to a priority run and to a run already going for
    // this account; returning null keeps callers from writing stale data.
    if (
      !isPriority &&
      (isPrioritySyncActiveFor(latest.id) || isAccountSyncing(latest.id))
    ) {
      return null
    }

    const runId = startSyncRun(latest.id, isPriority)

    setLoading(true)

    // A superseded run may still be inside the native sync; never run two.
    // The wait is bounded so a sync stuck on a dead server cannot hold the
    // priority slot, and with it every other account, forever.
    const earlierSyncSettled = await waitForAccountSyncWork(
      latest.id,
      SUPERSEDED_SYNC_WAIT_TIMEOUT_MS
    )
    if (!isSyncRunCurrent(latest.id, runId)) {
      releaseSyncRun(latest.id, runId)
      setLoading(false)
      return null
    }
    if (!earlierSyncSettled) {
      releaseSyncRun(latest.id, runId)
      settleCancelledSync(latest, setSyncStatus)
      reportError(
        latest.name ?? latest.id,
        new Error(t('account.sync.earlierSyncStuck'))
      )
      setLoading(false)
      return null
    }

    const synced = await trackAccountSyncWork(
      latest.id,
      runAccountSync(
        {
          config,
          forceFullScan,
          isCurrent: () => isSyncRunCurrent(latest.id, runId),
          lastKnownBlockHeight,
          latest,
          server,
          setLastKnownBlockHeight,
          setSyncProgress,
          setSyncStatus,
          wallet
        },
        runId,
        reportError
      )
    )
    setLoading(false)
    return synced
  }

  return { loading, prioritizeSync, syncAccountWithWallet }
}

export default useSyncAccountWithWallet
