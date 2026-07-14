import { useState } from 'react'
import { type BdkWallet } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { getWalletOverview, syncWallet, syncWithCoreWallet } from '@/api/bdk'
import { MempoolOracle } from '@/api/blockchain'
import BitcoinRpc from '@/api/rpc'
import { SYNC_CANCELLED_ERROR } from '@/constants/sync'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useSettingsStore } from '@/store/settings'
import { type Account } from '@/types/models/Account'
import { updateAccountObjectLabels } from '@/utils/account'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { getFiatPriceApiUrl } from '@/utils/fiatData'
import { formatTimestamp } from '@/utils/format'
import { parseAccountAddressesDetails } from '@/utils/parse'
import { reconcileTransactions } from '@/utils/transaction'

// Module-level sync state shared across all hook instances.
//
// syncingAccounts       – Set of account IDs currently being synced. Acts as a
//                         mutex so the same account is never synced twice at once.
// cancelledSyncs        – Syncs added here should abort at the next checkpoint.
//                         Used by prioritizeSync() to stop background syncs.
// prioritySyncAccountId – While set, new non-priority syncs yield immediately
//                         so the priority sync can use the full connection.
//                         Tracked by account id (not a bare boolean) so a
//                         second priority sync's cleanup can't clear a still-
//                         running first priority sync's hold.
const syncingAccounts = new Set<string>()
const cancelledSyncs = new Set<string>()
let prioritySyncAccountId: string | undefined

function isPrioritySyncActiveFor(accountId: string): boolean {
  return (
    prioritySyncAccountId !== undefined && prioritySyncAccountId !== accountId
  )
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

  // Cancel all currently running syncs except the given account, then evict
  // that account from the guard so it can be immediately re-synced at priority.
  function prioritizeSync(accountId: string) {
    prioritySyncAccountId = accountId
    for (const id of syncingAccounts) {
      if (id !== accountId) {
        cancelledSyncs.add(id)
      }
    }
    // Force-evict so the priority sync can enter even if it was already running
    syncingAccounts.delete(accountId)
  }

  async function syncAccountWithWallet(
    account: Account,
    wallet: BdkWallet,
    forceFullScan = false,
    isPriority = false
  ): Promise<Account | null> {
    const latest =
      useAccountsStore.getState().accounts.find((a) => a.id === account.id) ??
      account

    // If this sync was cancelled by a priority request, silently abort.
    if (cancelledSyncs.has(latest.id)) {
      cancelledSyncs.delete(latest.id)
      setSyncStatus(latest.id, 'synced')
      return null
    }

    // While a priority sync is running, hold off on non-priority background syncs
    // to avoid congesting the connection (especially important for RPC backends).
    if (!isPriority && isPrioritySyncActiveFor(latest.id)) {
      return null
    }

    if (syncingAccounts.has(latest.id)) {
      // Return null so callers don't overwrite the store with stale account data
      // while the live sync is still updating syncStatus / syncProgress.
      return null
    }

    syncingAccounts.add(latest.id)

    try {
      setLoading(true)
      setSyncStatus(latest.id, 'syncing')

      const checkpoint = wallet.latestCheckpoint()
      // Treat checkpoints near genesis (< 10,000) as a full scan —
      // a checkpoint at e.g. block 1052 means history was never actually scanned.
      //
      // Also force a full scan when switching FROM RPC to a BDK-based backend
      // (Electrum/Esplora). The RPC sync path bypasses BDK's keychain index,
      // so the BDK checkpoint reflects where BDK last stopped scanning, not
      // where all transactions were found. Without a full scan, BDK would only
      // pick up recent transactions and lose the older RPC-discovered history.
      const switchingFromRpc =
        server.backend !== 'rpc' && !!latest.rpcLastBlockHash
      const isFullScan =
        forceFullScan ||
        !checkpoint ||
        checkpoint.height < 10_000 ||
        switchingFromRpc
      const isGeneratedWallet =
        latest.keys[0]?.creationType === 'generateMnemonic'

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
          (currentHeight, tipHeight) => {
            setSyncProgress(latest.id, {
              tasksDone: currentHeight,
              totalTasks: tipHeight
            })
          },
          () => cancelledSyncs.has(latest.id),
          server.rpcWalletName,
          server.rpcScanFromHeight
        )
        walletSummary = coreResult
        newRpcLastBlockHash = coreResult.rpcLastBlockHash
      } else {
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

      // Post-sync checkpoint: if we were cancelled during the (potentially long)
      // sync call, discard the result so we don't overwrite what a priority sync
      // may have already written.
      if (cancelledSyncs.has(latest.id)) {
        cancelledSyncs.delete(latest.id)
        setSyncStatus(latest.id, 'synced')
        return null
      }

      // Capture cached prices before overwriting transactions with fresh BDK data
      const cachedPrices: Record<string, number | undefined> = {}
      for (const tx of latest.transactions) {
        if (tx.prices?.USD !== undefined) {
          cachedPrices[tx.id] = tx.prices.USD
        }
      }

      let updatedAccount: Account = { ...latest }

      updatedAccount.transactions = walletSummary.transactions
      updatedAccount.utxos = walletSummary.utxos
      updatedAccount.addresses = walletSummary.addresses
      updatedAccount.summary = walletSummary.summary
      if (newRpcLastBlockHash) {
        updatedAccount.rpcLastBlockHash = newRpcLastBlockHash
      }

      updatedAccount.addresses = parseAccountAddressesDetails(updatedAccount)
      updatedAccount = updateAccountObjectLabels(updatedAccount)

      // Apply cached prices and collect timestamps only for unpriced transactions
      const unpricedTimestamps: number[] = []
      for (const tx of updatedAccount.transactions) {
        const cachedPrice = cachedPrices[tx.id]
        if (cachedPrice !== undefined) {
          tx.prices = { USD: cachedPrice }
        } else if (tx.timestamp) {
          unpricedTimestamps.push(formatTimestamp(tx.timestamp))
        }
      }

      if (unpricedTimestamps.length > 0) {
        const { fetchHistoricalPrices } = useSettingsStore.getState()
        if (fetchHistoricalPrices) {
          const uniqueTimestamps = [...new Set(unpricedTimestamps)]
          const oracle = new MempoolOracle(getFiatPriceApiUrl())
          try {
            const fetchedPrices = await oracle.getPricesAt(
              'USD',
              uniqueTimestamps
            )
            const priceMap: Record<number, number> = {}
            for (const [i, ts] of uniqueTimestamps.entries()) {
              priceMap[ts] = fetchedPrices[i]
            }
            for (const tx of updatedAccount.transactions) {
              if (!tx.prices?.USD && tx.timestamp) {
                const price = priceMap[formatTimestamp(tx.timestamp)]
                if (price !== undefined) {
                  tx.prices = { USD: price }
                }
              }
            }
          } catch {
            toast.error(t('account.sync.historicalPricesFailed'))
          }
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

      // After a successful full BDK sync (Electrum/Esplora), clear
      // rpcLastBlockHash so future syncs are incremental again.
      if (switchingFromRpc) {
        updatedAccount.rpcLastBlockHash = undefined
      }

      return updatedAccount
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)

      // Cancellation is not an error — leave status as 'synced' (or wherever
      // it was) so the UI doesn't show a red error state.
      if (msg === SYNC_CANCELLED_ERROR) {
        setSyncStatus(latest.id, 'synced')
        return null
      }

      setSyncStatus(latest.id, 'error')
      toast.error(`${latest.name ?? latest.id}: ${t('account.syncFailed')}`)
      return latest
    } finally {
      syncingAccounts.delete(latest.id)
      cancelledSyncs.delete(latest.id)
      // If this was the priority sync, lift the hold so background syncs can
      // resume — but only if we still own the hold (a newer priority sync for
      // a different account may have taken over since we started).
      if (isPriority && prioritySyncAccountId === latest.id) {
        prioritySyncAccountId = undefined
      }
      setLoading(false)
    }
  }

  return { loading, prioritizeSync, syncAccountWithWallet }
}

export default useSyncAccountWithWallet
