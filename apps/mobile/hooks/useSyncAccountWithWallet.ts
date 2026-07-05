import { useState } from 'react'
import { KeychainKind, type BdkWallet } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { getWalletOverview, syncWallet, syncWithCoreWallet } from '@/api/bdk'
import { MempoolOracle } from '@/api/blockchain'
import BitcoinRpc from '@/api/rpc'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useSettingsStore } from '@/store/settings'
import { type Account } from '@/types/models/Account'
import { updateAccountObjectLabels } from '@/utils/account'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { getFiatPriceApiUrl } from '@/utils/fiatData'
import { formatTimestamp } from '@/utils/format'
import { devLog } from '@/utils/logger'
import { parseAccountAddressesDetails } from '@/utils/parse'

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
        devLog(`[sync] cancel requested for: ${id} (priority: ${accountId})`)
      }
    }
    // Force-evict so the priority sync can enter even if it was already running
    syncingAccounts.delete(accountId)
  }

  async function syncAccountWithWallet(
    account: Account,
    wallet: BdkWallet,
    isPriority = false
  ): Promise<Account | null> {
    const latest =
      useAccountsStore.getState().accounts.find((a) => a.id === account.id) ??
      account

    // If this sync was cancelled by a priority request, silently abort.
    if (cancelledSyncs.has(latest.id)) {
      cancelledSyncs.delete(latest.id)
      devLog(`[sync] aborted (was cancelled): ${latest.name ?? latest.id}`)
      setSyncStatus(latest.id, 'synced')
      return null
    }

    // While a priority sync is running, hold off on non-priority background syncs
    // to avoid congesting the connection (especially important for RPC backends).
    if (!isPriority && isPrioritySyncActiveFor(latest.id)) {
      devLog(
        `[sync] deferred — priority sync in progress: ${latest.name ?? latest.id}`
      )
      return null
    }

    if (syncingAccounts.has(latest.id)) {
      devLog(
        `[sync] skipped — already in progress: ${latest.name ?? latest.id}`
      )
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
        !checkpoint || checkpoint.height < 10_000 || switchingFromRpc
      const isGeneratedWallet =
        latest.keys[0]?.creationType === 'generateMnemonic'

      const checkpointHeight = checkpoint?.height ?? 0

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

      // Derive first 5 receive addresses to verify script type / derivation / passphrase
      const previewAddrs: string[] = []
      const PREVIEW_ADDR_COUNT = 5
      for (let i = 0; i < PREVIEW_ADDR_COUNT; i += 1) {
        try {
          previewAddrs.push(
            wallet.peekAddress(KeychainKind.External, i).address
          )
        } catch {
          break
        }
      }

      // Birthday for scan purposes:
      // - Generated wallets: createdAt IS the real birthday (wallet was just made)
      // - Imported wallets:  only the user-set birthdayDate counts;
      //                      createdAt is just the app import date — useless as scan floor
      const effectiveBirthday = isGeneratedWallet
        ? latest.createdAt
        : (latest.birthdayDate ?? undefined)

      const birthdayLabel = isGeneratedWallet
        ? `${latest.createdAt.toISOString()} (generated)`
        : latest.birthdayDate
          ? `${latest.birthdayDate.toISOString()} (user-set)`
          : 'not set'

      const noBirthdayWarning =
        !isGeneratedWallet && !latest.birthdayDate && server.backend === 'rpc'
          ? '  ⚠ no birthday set — will estimate start height from BDK checkpoint (set Birthday in Account Settings for guaranteed full history)'
          : ''

      const birthdayMissingWarning =
        !isGeneratedWallet && !latest.birthdayDate && server.backend !== 'rpc'
          ? '  ⚠ imported wallet — birthday not set, some history may be missed'
          : ''

      devLog(
        `[sync] ── ${latest.name ?? latest.id}
         network:      ${latest.network}  scriptType: ${latest.keys[0]?.scriptVersion ?? 'unknown'}
         backend:      ${server.backend}  ${server.url}
         creationType: ${latest.keys[0]?.creationType ?? 'unknown'}
         birthday:     ${birthdayLabel}
         checkpoint:   ${checkpointHeight}  tip: ${tip ?? '? (not yet fetched)'}  gap: ${config.stopGap}
         isFullScan:   ${isFullScan}  isGenerated: ${isGeneratedWallet}${noBirthdayWarning}${birthdayMissingWarning}
         addr[0]: ${previewAddrs[0] ?? '?'}
         addr[1]: ${previewAddrs[1] ?? '?'}
         addr[2]: ${previewAddrs[2] ?? '?'}
         addr[3]: ${previewAddrs[3] ?? '?'}
         addr[4]: ${previewAddrs[4] ?? '?'}`
      )

      // RPC backend always uses the Bitcoin Core wallet path (importdescriptors +
      // rescanblockchain + listtransactions) — the same approach as Sparrow Wallet.
      // Compact block filters are not used for RPC.
      const useCoreWallet = server.backend === 'rpc' && !!server.rpcCredentials

      let walletSummary: ReturnType<typeof getWalletOverview>
      let newRpcLastBlockHash: string | undefined

      if (useCoreWallet && server.rpcCredentials) {
        const coreResult = await syncWithCoreWallet(
          latest,
          wallet,
          server.url,
          server.rpcCredentials,
          appNetworkToBdkNetwork(server.network),
          config.stopGap,
          (pct) => {
            setSyncProgress(latest.id, {
              tasksDone: pct,
              totalTasks: 100
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
        devLog(
          `[sync] discarding result — was cancelled during sync: ${latest.name ?? latest.id}`
        )
        setSyncStatus(latest.id, 'synced')
        return null
      }

      const newCheckpoint = wallet.latestCheckpoint()?.height ?? 0
      const blocksScanned = newCheckpoint - checkpointHeight
      devLog(
        `[sync] ── done: ${latest.name ?? latest.id}\n` +
          `         path: ${useCoreWallet ? 'core-wallet' : server.backend}\n` +
          `         blocks: ${checkpointHeight} → ${newCheckpoint} (+${blocksScanned})\n` +
          `         txs: ${walletSummary.transactions.length}  utxos: ${walletSummary.utxos.length}  addrs: ${walletSummary.addresses.length}`
      )

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
        if (cachedPrices[tx.id] !== undefined) {
          tx.prices = { USD: cachedPrices[tx.id]! }
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

      updatedAccount.syncStatus = 'synced'
      updatedAccount.lastSyncedAt = new Date()

      // After a successful full BDK sync (Electrum/Esplora), clear
      // rpcLastBlockHash so future syncs are incremental again.
      if (switchingFromRpc) {
        updatedAccount.rpcLastBlockHash = undefined
        devLog(
          `[sync] cleared rpcLastBlockHash after full Electrum/Esplora sync`
        )
      }

      return updatedAccount
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      devLog(`[sync] ── error: ${latest.name ?? latest.id}: ${msg}`)

      // Cancellation is not an error — leave status as 'synced' (or wherever
      // it was) so the UI doesn't show a red error state.
      if (msg === 'sync-cancelled') {
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
