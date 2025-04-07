import { produce } from 'immer'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import { type Label } from '@/utils/bip329'
import { getUtxoOutpoint } from '@/utils/utxo'

type AccountsState = {
  accounts: Account[]
  tags: string[]
}

type AccountsAction = {
  addAccount: (account: Account) => void
  updateAccount: (account: Account) => Promise<void>
  updateAccountName: (id: Account['id'], newName: string) => void
  setIsSyncing: (
    id: Account['id'],
    isSyncing: NonNullable<Account['isSyncing']>
  ) => void
  deleteAccount: (id: Account['id']) => void
  deleteAccounts: () => void
  loadTx: (accountId: Account['id'], tx: Transaction) => void
  getTags: () => string[]
  setTags: (tags: string[]) => void
  setAddrLabel: (account: string, addr: string, label: string) => void
  setTxLabel: (accountId: Account['id'], txid: string, label: string) => void
  setUtxoLabel: (
    accountId: Account['id'],
    txid: string,
    vout: number,
    label: string
  ) => void
  importLabels: (account: string, labels: Label[]) => number
}

const useAccountsStore = create<AccountsState & AccountsAction>()(
  persist(
    (set, get) => ({
      accounts: [],
      tags: [],
      addAccount: (account) => {
        set(
          produce((state: AccountsState) => {
            state.accounts.push(account)
          })
        )
      },
      updateAccount: async (account) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (_account) => _account.id === account.id
            )
            if (index !== -1) state.accounts[index] = account
          })
        )
      },
      updateAccountName: (id, newName) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.id === id
            )
            if (index !== -1) state.accounts[index].name = newName
          })
        )
      },
      setIsSyncing: async (id, isSyncing) => {
        const account = get().accounts.find((account) => account.id === id)
        if (!account) return

        // Update syncing state
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.id === id
            )
            if (index !== -1) state.accounts[index].isSyncing = isSyncing
          })
        )

        // If syncing is enabled and we have Nostr credentials, fetch and import labels
        // if (
        //   isSyncing &&
        //   account.nostr.pubkey &&
        //   account.nostr.relays &&
        //   account.nostr.relays.length > 0
        // ) {
        //   try {
        //     const nostrApi = new NostrAPI(account.nostr.relays)
        //
        //     // Fetch labels from Nostr
        //     const { labels, totalMessages } =
        //       await nostrApi.fetchAndImportLabels(account)
        //
        //     // Import labels if any were found
        //     if (labels.length > 0) {
        //       get().importLabels(account.id, labels)
        //       toast(`Imported ${totalMessages} labels`)
        //     }
        //   } catch {
        //     // Revert syncing state on error
        //     set(
        //       produce((state: AccountsState) => {
        //         const index = state.accounts.findIndex(
        //           (account) => account.id === id
        //         )
        //         if (index !== -1) state.accounts[index].isSyncing = false
        //       })
        //     )
        //   }
        // }
      },
      deleteAccount: (id) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.id === id
            )
            if (index !== -1) {
              state.accounts.splice(index, 1)
            }
          })
        )
      },
      deleteAccounts: () => {
        set(() => ({ accounts: [] }))
      },
      loadTx: async (accountId, tx) => {
        const txid = tx.id
        const accounts = get().accounts
        const accountIndex = accounts.findIndex(
          (account) => account.id === accountId
        )

        if (accountIndex === -1) return

        const account = accounts[accountIndex]
        const txIndex = account.transactions.findIndex((tx) => tx.id === txid)

        if (txIndex === -1) return

        set(
          produce((state) => {
            state.accounts[accountIndex].transactions[txIndex] = tx
          })
        )
      },
      getTags: () => {
        return get().tags
      },
      setTags: (tags: string[]) => {
        set({ tags })
      },
      setAddrLabel: (accountName, addr, label) => {
        const account = get().accounts.find(
          (account) => account.name === accountName
        )
        if (!account) return

        // if (account.nostr.autoSync && account.nostr.pubkey) {
        //   const nostrApi = new NostrAPI(account.nostr.relays)
        //   nostrApi.sendLabelsToNostr(
        //     account.keys[0].secret as Uint8Array,
        //     account.nostr.pubkey,
        //     account
        //   )
        //   toast('sent labels to nostr')
        // }

        const addrIndex = account.addresses.findIndex(
          (address) => address.address === addr
        )
        if (addrIndex === -1) return

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.name === accountName
            )
            state.accounts[index].addresses[addrIndex].label = label
          })
        )
      },
      setTxLabel: (accountId, txid, label) => {
        const account = get().accounts.find(
          (account) => account.id === accountId
        )
        if (!account) return

        // if (account.nostr.autoSync && account.nostr.pubkey) {
        //   const nostrApi = new NostrAPI(account.nostr.relays)
        //   nostrApi.sendLabelsToNostr(
        //     account.keys[0].secret as Uint8Array,
        //     account.nostr.pubkey,
        //     account
        //   )
        //   toast('sent labels to nostr')
        // }

        const txIndex = account.transactions.findIndex((tx) => tx.id === txid)
        if (txIndex === -1) return

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.id === accountId
            )
            state.accounts[index].transactions[txIndex].label = label
          })
        )
      },
      setUtxoLabel: (accountId, txid, vout, label) => {
        const account = get().accounts.find(
          (account) => account.id === accountId
        )
        if (!account) return

        // if (account.nostrLabelsAutoSync && account.nostrPubkey) {
        //   const nostrApi = new NostrAPI(account.nostrRelays || [])
        //   nostrApi.sendLabelsToNostr(
        //     account.keys[0].secret as Uint8Array,
        //     account.nostrPubkey,
        //     account
        //   )
        // }

        const utxoIndex = account.utxos.findIndex((u) => {
          return u.txid === txid && u.vout === vout
        })
        if (utxoIndex === -1) return

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.id === accountId
            )
            state.accounts[index].utxos[utxoIndex].label = label
          })
        )
      },
      importLabels: (accountId: string, labels: Label[]) => {
        const account = get().accounts.find(
          (account) => account.id === accountId
        )

        if (!account) return 0

        const transactionMap: Record<string, number> = {}
        const utxoMap: Record<string, number> = {}
        const addressMap: Record<string, number> = {}

        account.transactions.forEach((tx, index) => {
          transactionMap[tx.id] = index
        })
        account.utxos.forEach((utxo, index) => {
          utxoMap[getUtxoOutpoint(utxo)] = index
        })
        account.addresses.forEach((address, index) => {
          addressMap[address.address] = index
        })

        let labelsAdded = 0

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.id === accountId
            )
            labels.forEach((labelObj) => {
              const label = labelObj.label

              if (
                labelObj.type === 'tx' &&
                transactionMap[labelObj.ref] !== undefined
              ) {
                const txIndex = transactionMap[labelObj.ref]
                state.accounts[index].transactions[txIndex].label = label
                labelsAdded += 1
              }

              if (
                labelObj.type === 'output' &&
                utxoMap[labelObj.ref] !== undefined
              ) {
                const utxoIndex = utxoMap[labelObj.ref]
                state.accounts[index].utxos[utxoIndex].label = label
                labelsAdded += 1
              }

              if (
                labelObj.type === 'addr' &&
                addressMap[labelObj.ref] !== undefined
              ) {
                const addrIndex = addressMap[labelObj.ref]
                state.accounts[index].addresses[addrIndex].label = label
                labelsAdded += 1
              }
            })
          })
        )
        return labelsAdded
      }
    }),
    {
      name: 'satsigner-accounts',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useAccountsStore }
