import { produce } from 'immer'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import {
  type Account,
  type SyncProgress,
  type SyncStatus
} from '@/types/models/Account'
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
  updateAccountNostr: (
    id: Account['id'],
    nostr: Partial<Account['nostr']>
  ) => void
  setLastSyncedAt: (id: Account['id'], date: Date) => void
  setSyncStatus: (id: Account['id'], syncStatus: SyncStatus) => void
  setSyncProgress: (id: Account['id'], syncProgress: SyncProgress) => void
  deleteAccount: (id: Account['id']) => void
  deleteAccounts: () => void
  loadTx: (accountId: Account['id'], tx: Transaction) => void
  getTags: () => string[]
  setTags: (tags: string[]) => void
  deleteTags: () => void
  setAddrLabel: (
    accountId: Account['id'],
    addr: string,
    label: string
  ) => Account | undefined
  setTxLabel: (
    accountId: Account['id'],
    txid: string,
    label: string
  ) => Account | undefined
  setUtxoLabel: (
    accountId: Account['id'],
    txid: string,
    vout: number,
    label: string
  ) => Account | undefined
  importLabels: (accountId: Account['id'], labels: Label[]) => number
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
            if (index !== -1) {
              state.accounts[index] = { ...account }
            }
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
      updateAccountNostr: (id, nostr) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.id === id
            )
            if (index === -1) return
            state.accounts[index].nostr = {
              ...state.accounts[index].nostr,
              ...nostr
            }
          })
        )
      },
      setLastSyncedAt: (id, date) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.id === id
            )
            if (index !== -1) state.accounts[index].lastSyncedAt = date
          })
        )
      },
      setSyncStatus: (id, syncStatus) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.id === id
            )
            if (index !== -1) state.accounts[index].syncStatus = syncStatus
          })
        )
      },
      setSyncProgress: (id, syncProgress) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.id === id
            )
            if (index !== -1) {
              state.accounts[index].syncProgress = {
                ...syncProgress
              }
            }
          })
        )
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
      deleteTags: () => {
        set({ tags: [] })
      },
      setAddrLabel: (accountId, addr, label) => {
        const account = get().accounts.find(
          (account) => account.id === accountId
        )
        if (!account) return undefined

        const addrIndex = account.addresses.findIndex(
          (address) => address.address === addr
        )
        if (addrIndex === -1) return undefined

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.id === accountId
            )
            state.accounts[index].addresses[addrIndex].label = label
          })
        )
        const updatedAccount = { ...account }
        updatedAccount.addresses = [...account.addresses]
        updatedAccount.addresses[addrIndex] = {
          ...account.addresses[addrIndex],
          label
        }
        return updatedAccount
      },
      setTxLabel: (accountId, txid, label) => {
        const account = get().accounts.find(
          (account) => account.id === accountId
        )
        if (!account) return undefined

        const txIndex = account.transactions.findIndex((tx) => tx.id === txid)
        if (txIndex === -1) return undefined

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.id === accountId
            )
            state.accounts[index].transactions[txIndex].label = label
          })
        )

        const updatedAccount = { ...account }
        updatedAccount.transactions = [...account.transactions]
        updatedAccount.transactions[txIndex] = {
          ...account.transactions[txIndex],
          label
        }
        return updatedAccount
      },
      setUtxoLabel: (accountId, txid, vout, label) => {
        const account = get().accounts.find(
          (account) => account.id === accountId
        )
        if (!account) return undefined

        const utxoIndex = account.utxos.findIndex((u) => {
          return u.txid === txid && u.vout === vout
        })
        if (utxoIndex === -1) return undefined

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.id === accountId
            )
            state.accounts[index].utxos[utxoIndex].label = label
          })
        )

        const updatedAccount = { ...account }
        updatedAccount.utxos = [...account.utxos]
        updatedAccount.utxos[utxoIndex] = {
          ...account.utxos[utxoIndex],
          label
        }
        return updatedAccount
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
