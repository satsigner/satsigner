import { useState } from 'react'
import { type BdkWallet } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'

import { syncWallet } from '@/api/bdk'
import { getWalletOverview, revealKnownAddresses } from '@/api/bdkWalletMappers'
import { syncWithCoreWallet } from '@/api/coreWalletSync'
import { ElectrumUnreachableError } from '@/api/electrumReachability'
import BitcoinRpc from '@/api/rpc'
import { SYNC_CANCELLED_ERROR, SYNC_CONCURRENCY } from '@/constants/sync'
import { markServerConnectionFailed } from '@/hooks/useVerifyConnection'
import { t } from '@/locales'
import { SyncTimeoutError, createSyncQueue } from '@/services/syncQueue'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { type Account, type SyncProgress } from '@/types/models/Account'
import { type Prices } from '@/types/models/Blockchain'
import { type Config, type Server } from '@/types/settings/blockchain'
import { updateAccountObjectLabels } from '@/utils/account'
import { getSyncStallTimeoutMs, shouldFullScan } from '@/utils/accountSync'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { formatTimestamp } from '@/utils/format'
import { parseAccountAddressesDetails } from '@/utils/parse'
import { resolveHistoricalPrices } from '@/utils/resolveHistoricalPrices'
import {
  type SyncErrorReporter,
  reportSyncFailure
} from '@/utils/syncFailureToasts'
import { reconcileTransactions } from '@/utils/transaction'

const walletSyncQueue = createSyncQueue<Account | null>(SYNC_CONCURRENCY)

/** Drop a queued sync or abort a running one for this account. */
function cancelAccountSync(accountId: string) {
  walletSyncQueue.cancel(accountId)
}

function isAccountSyncing(accountId: string): boolean {
  return walletSyncQueue.isActive(accountId)
}

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
    latest: Account
    reportProgress: () => void
    server: Server
    signal: AbortSignal
    wallet: BdkWallet
  }

async function syncWalletAccount({
  config,
  forceFullScan,
  lastKnownBlockHeight,
  latest,
  reportProgress,
  server,
  setLastKnownBlockHeight,
  setSyncProgress: storeSyncProgress,
  setSyncStatus,
  signal,
  wallet
}: WalletSyncParams): Promise<Account | null> {
  setSyncStatus(latest.id, 'syncing')

  function setSyncProgress(id: string, progress: SyncProgress) {
    reportProgress()
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

function useSyncAccountWithWallet() {
  const setSyncStatus = useAccountsStore((state) => state.setSyncStatus)
  const setSyncProgress = useAccountsStore((state) => state.setSyncProgress)

  const [loading, setLoading] = useState(false)

  function settleStatusAfterCancel(accountId: string) {
    if (walletSyncQueue.isActive(accountId)) {
      return
    }
    const current = useAccountsStore
      .getState()
      .accounts.find((a) => a.id === accountId)?.syncStatus
    if (current === 'syncing' || current === 'queued') {
      setSyncStatus(accountId, 'unsynced')
    }
  }

  /**
   * Queue a sync for this account. A second request for an account that is
   * already queued or syncing shares that job instead of starting another,
   * and resolves to null so callers don't write the same result twice.
   * `forceFullScan` replaces a running incremental sync.
   */
  async function syncAccountWithWallet(
    account: Account,
    wallet: BdkWallet,
    forceFullScan = false,
    isPriority = false,
    reportError: SyncErrorReporter = reportSyncFailure
  ): Promise<Account | null> {
    // Read at call time: a sync started right after a backup restore must
    // use the restored server, not the one from this hook's last render.
    const {
      configs,
      lastKnownBlockHeight,
      selectedNetwork,
      setLastKnownBlockHeight
    } = useBlockchainStore.getState()
    const { server, config } = configs[selectedNetwork]

    if (forceFullScan) {
      walletSyncQueue.cancel(account.id)
    }
    const isDuplicate = walletSyncQueue.isActive(account.id)

    setLoading(true)
    const job = walletSyncQueue.enqueue(
      account.id,
      (signal, reportProgress) => {
        const latest =
          useAccountsStore
            .getState()
            .accounts.find((a) => a.id === account.id) ?? account
        return syncWalletAccount({
          config,
          forceFullScan,
          lastKnownBlockHeight,
          latest,
          reportProgress,
          server,
          setLastKnownBlockHeight,
          setSyncProgress,
          setSyncStatus,
          signal,
          wallet
        })
      },
      {
        onQueued: () => setSyncStatus(account.id, 'queued'),
        priority: isPriority,
        timeoutMs: getSyncStallTimeoutMs(server)
      }
    )

    try {
      const result = await job
      if (result === null) {
        settleStatusAfterCancel(account.id)
      }
      return isDuplicate ? null : result
    } catch (error) {
      if (isDuplicate) {
        return null
      }
      return handleSyncError(account, error, reportError)
    } finally {
      setLoading(false)
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

    if (error instanceof ElectrumUnreachableError) {
      markServerConnectionFailed()
    }
    const syncStatus = error instanceof SyncTimeoutError ? 'timeout' : 'error'
    setSyncStatus(account.id, syncStatus)
    const latest =
      useAccountsStore.getState().accounts.find((a) => a.id === account.id) ??
      account
    reportError(latest.name ?? latest.id, error)
    return { ...latest, syncStatus }
  }

  return { loading, syncAccountWithWallet }
}

export { cancelAccountSync, isAccountSyncing }
export default useSyncAccountWithWallet
