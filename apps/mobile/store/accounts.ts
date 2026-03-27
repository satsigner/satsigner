import { produce } from 'immer'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import {
  type Account,
  type SyncProgress,
  type SyncStatus
} from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { dropSeedFromKey } from '@/utils/account'
import { type Label } from '@/utils/bip329'
import { getUtxoOutpoint } from '@/utils/utxo'

type AccountsState = {
  accounts: Account[]
  tags: string[]
}

type AccountsAction = {
  addAccount: (account: Account) => void
  updateAccount: (account: Account) => void
  updateAccountName: (id: Account['id'], newName: string) => void
  updateKeyName: (id: Account['id'], keyIndex: number, newName: string) => void
  updateAccountNostr: (
    id: Account['id'],
    nostr: Partial<Account['nostr']>
  ) => void
  markDmsAsRead: (id: Account['id']) => void
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
  // TODO: remove async code from this, and not deal with error handling
  dropSeedFromKey: (
    accountId: Account['id'],
    keyIndex: number
  ) => Promise<{ success: boolean; message: string }>
  resetKey: (accountId: Account['id'], keyIndex: number) => void
}

function resolveOutputAddress(
  transactions: Transaction[],
  txid: string,
  vout: number
): string | undefined {
  return transactions.find((tx) => tx.id === txid)?.vout[vout]?.address
}

const useAccountsStore = create<AccountsState & AccountsAction>()(
  persist(
    (set, get) => ({
      accounts: [],
      addAccount: (account) => {
        set(
          produce((state: AccountsState) => {
            state.accounts.push(account)
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
      deleteTags: () => {
        set({ tags: [] })
      },
      dropSeedFromKey: async (accountId, keyIndex) => {
        // TODO: store should not be the one doing validation or error handling.
        // It should be handled by the one calling the store methods.
        const state = get()
        const account = state.accounts.find((acc) => acc.id === accountId)

        if (!account || !account.keys[keyIndex]) {
          return {
            message: 'Account or key not found',
            success: false
          }
        }

        try {
          const newKey = await dropSeedFromKey(account.keys[keyIndex])
          set(
            produce((state) => {
              const accountIndex = state.accounts.findIndex(
                (acc: Account) => acc.id === accountId
              )
              if (accountIndex !== -1) {
                throw new Error('Account not found')
              }
              state.accounts[accountIndex].keys[keyIndex] = newKey
            })
          )
          return {
            message: 'Seed dropped successfully',
            success: true
          }
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'unknown reason'
          return {
            message: `Failed to drop seed: ${reason}`,
            success: false
          }
        }
      },
      getTags: () => get().tags,
      importLabels: (accountId: string, labels: Label[]) => {
        const account = get().accounts.find(
          (account) => account.id === accountId
        )

        if (!account) {
          return 0
        }

        const transactionMap: Record<string, number> = {}
        const utxoMap: Record<string, number> = {}
        const addressMap: Record<string, number> = {}

        for (const [index, tx] of account.transactions.entries()) {
          transactionMap[tx.id] = index
        }
        for (const [index, utxo] of account.utxos.entries()) {
          utxoMap[getUtxoOutpoint(utxo)] = index
        }
        for (const [index, address] of account.addresses.entries()) {
          addressMap[address.address] = index
        }

        let labelsAdded = 0

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.id === accountId
            )
            for (const labelObj of labels) {
              const { label } = labelObj

              state.accounts[index].labels[labelObj.ref] = labelObj

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
            }
          })
        )
        return labelsAdded
      },
      loadTx: async (accountId, tx) => {
        const txid = tx.id
        const { accounts } = get()
        const accountIndex = accounts.findIndex(
          (account) => account.id === accountId
        )

        if (accountIndex === -1) {
          return
        }

        const account = accounts[accountIndex]
        const txIndex = account.transactions.findIndex((tx) => tx.id === txid)

        if (txIndex === -1) {
          return
        }

        set(
          produce((state) => {
            state.accounts[accountIndex].transactions[txIndex] = tx
          })
        )
      },
      markDmsAsRead: (id) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.id === id
            )
            if (index === -1 || !state.accounts[index].nostr) {
              return
            }
            state.accounts[index].nostr.dms = state.accounts[
              index
            ].nostr.dms.map((dm) =>
              dm.read === false ? { ...dm, read: true } : dm
            )
          })
        )
      },
      resetKey: async (accountId, keyIndex) => {
        set(
          produce((state) => {
            const accountIndex = state.accounts.findIndex(
              (acc: Account) => acc.id === accountId
            )
            if (accountIndex === -1) {
              return
            }
            state.accounts[accountIndex].keys[keyIndex] = {
              creationType: undefined,
              fingerprint: undefined,
              index: keyIndex,
              iv: undefined,
              mnemonicWordCount: undefined,
              name: '',
              scriptVersion: undefined,
              secret: undefined
            }
          })
        )
      },
      setAddrLabel: (accountId, addr, label) => {
        const account = get().accounts.find(
          (account) => account.id === accountId
        )
        if (!account) {
          return undefined
        }

        const addrIndex = account.addresses.findIndex(
          (address) => address.address === addr
        )

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.id === accountId
            )

            state.accounts[index].labels[addr] = {
              label,
              ref: addr,
              type: 'addr'
            }

            if (addrIndex !== -1) {
              state.accounts[index].addresses[addrIndex].label = label
            }

            // utxos associated with this address will inherit its labels
            state.accounts[index].utxos = state.accounts[index].utxos.map(
              (utxo: Utxo) => {
                const newUtxo = { ...utxo }
                const isRelated = utxo.addressTo === addr
                if (!isRelated) {
                  return newUtxo
                }

                const utxoRef = `${utxo.txid}:${utxo.vout}`
                const utxoHasLabel = state.accounts[index].labels[utxoRef]
                if (!utxoHasLabel) {
                  state.accounts[index].labels[utxoRef] = {
                    label,
                    ref: utxoRef,
                    type: 'output'
                  }
                  newUtxo.label = label
                }

                return newUtxo
              }
            )

            // tx associated with this address will inherit its label
            state.accounts[index].transactions = state.accounts[
              index
            ].transactions.map((tx: Transaction) => {
              const newTx = { ...tx }
              const isRelated = tx.vout.some(
                (output) => output.address === addr
              )
              if (!isRelated) {
                return newTx
              }

              const txHasLabel = state.accounts[index].labels[tx.id]
              if (!txHasLabel) {
                state.accounts[index].labels[tx.id] = {
                  label,
                  ref: tx.id,
                  type: 'tx'
                }
                newTx.label = label
              }

              return newTx
            })

            // Transactions that spent from this address also inherit its label
            for (const [txIdx, tx] of (
              state.accounts[index].transactions as Transaction[]
            ).entries()) {
              const spendFromAddr = tx.vin.some(
                (input: Transaction['vin'][number]) => {
                  const resolved = resolveOutputAddress(
                    state.accounts[index].transactions,
                    input.previousOutput.txid,
                    input.previousOutput.vout
                  )
                  return resolved === addr
                }
              )
              if (!spendFromAddr) {
                continue
              }

              const txHasLabel = state.accounts[index].labels[tx.id]
              if (!txHasLabel) {
                state.accounts[index].labels[tx.id] = {
                  label,
                  ref: tx.id,
                  type: 'tx'
                }
                state.accounts[index].transactions[txIdx].label = label
              }
            }
          })
        )

        return get().accounts.find((a) => a.id === accountId)
      },
      setLastSyncedAt: (id, date) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.id === id
            )
            if (index !== -1) {
              state.accounts[index].lastSyncedAt = date
            }
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
      setSyncStatus: (id, syncStatus) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.id === id
            )
            if (index !== -1) {
              state.accounts[index].syncStatus = syncStatus
            }
          })
        )
      },
      setTags: (tags: string[]) => {
        set({ tags })
      },
      setTxLabel: (accountId, txid, label) => {
        const account = get().accounts.find(
          (account) => account.id === accountId
        )

        if (!account) {
          return undefined
        }

        const txIndex = account.transactions.findIndex((tx) => tx.id === txid)

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.id === accountId
            )

            const currentLabel = state.accounts[index].labels[txid] || {}
            state.accounts[index].labels[txid] = {
              ...currentLabel,
              label,
              ref: txid,
              type: 'tx'
            }

            if (txIndex === -1) {
              return
            }

            state.accounts[index].transactions[txIndex].label = label

            // Labeless outputs and their addresses will inherit the tx label
            for (const [vout, output] of (
              state.accounts[index].transactions[txIndex]
                .vout as Transaction['vout']
            ).entries()) {
              const outputRef = `${txid}:${vout}`
              const addressRef = output.address
              const outputHasLabel = state.accounts[index].labels[outputRef]
              const addressHasLabel = state.accounts[index].labels[addressRef]

              // output label inheritance
              if (!outputHasLabel) {
                state.accounts[index].labels[outputRef] = {
                  label,
                  ref: outputRef,
                  type: 'output'
                }

                // also update the utxo object if it exist
                const utxoIndex = state.accounts[index].utxos.findIndex(
                  (utxo: Utxo) => utxo.txid === txid && utxo.vout === vout
                )
                if (utxoIndex !== -1) {
                  state.accounts[index].utxos[utxoIndex].label = label
                }
              }

              // address label inheritance
              if (!addressHasLabel) {
                state.accounts[index].labels[addressRef] = {
                  label,
                  ref: addressRef,
                  type: 'addr'
                }

                // also update the address object if it exists
                const addressIndex = state.accounts[index].addresses.findIndex(
                  (address: Address) => address.address === addressRef
                )
                if (addressIndex !== -1) {
                  state.accounts[index].addresses[addressIndex].label = label
                }
              }
            }

            // Labeless inputs and their addresses will inherit the tx label
            for (const input of state.accounts[index].transactions[txIndex]
              .vin as Transaction['vin']) {
              const { txid, vout } = input.previousOutput
              const outputRef = `${txid}:${vout}`
              const outputHasLabel = state.accounts[index].labels[outputRef]

              // input label inheritance (the input's previous output)
              if (!outputHasLabel) {
                state.accounts[index].labels[outputRef] = {
                  label,
                  ref: outputRef,
                  type: 'output'
                }

                // we do not have to update any utxo object, like we did when
                // looping throughout the vout property. Because the input has
                // been spent, its previous output cannot be an utxo (unspent
                // tx output)
              }

              // Update the vout object on the referenced transaction
              const refTxIndex = state.accounts[index].transactions.findIndex(
                (tx: Transaction) => tx.id === txid
              )
              if (
                refTxIndex !== -1 &&
                state.accounts[index].transactions[refTxIndex].vout[vout]
              ) {
                if (!outputHasLabel) {
                  state.accounts[index].transactions[refTxIndex].vout[
                    vout
                  ].label = label
                }
              }

              // Cascade to the address of the input's previous output
              const address = resolveOutputAddress(
                state.accounts[index].transactions,
                txid,
                vout
              )
              if (!address) {
                continue
              }

              const addressHasLabel = state.accounts[index].labels[address]
              if (!addressHasLabel) {
                state.accounts[index].labels[address] = {
                  label,
                  ref: address,
                  type: 'addr'
                }
                const addrIdx = state.accounts[index].addresses.findIndex(
                  (a: Address) => a.address === address
                )
                if (addrIdx !== -1) {
                  state.accounts[index].addresses[addrIdx].label = label
                }
              }
            }
          })
        )

        return get().accounts.find((a) => a.id === accountId)
      },
      setUtxoLabel: (accountId, txid, vout, label) => {
        const account = get().accounts.find(
          (account) => account.id === accountId
        )

        if (!account) {
          return undefined
        }

        const txIndex = account.transactions.findIndex((tx) => tx.id === txid)

        const utxoIndex = account.utxos.findIndex(
          (u) => u.txid === txid && u.vout === vout
        )

        const address =
          utxoIndex !== -1 ? account.utxos[utxoIndex].addressTo : ''

        const addressIndex = address
          ? account.addresses.findIndex((addr) => addr.address === address)
          : -1

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.id === accountId
            )

            // UTXO label update
            const utxoRef = `${txid}:${vout}`
            state.accounts[index].labels[utxoRef] = {
              label,
              ref: utxoRef,
              type: 'output'
            }

            if (utxoIndex !== -1) {
              state.accounts[index].utxos[utxoIndex].label = label
            }

            // UTXO's tx label update
            const txHasLabel = state.accounts[index].labels[txid]
            if (!txHasLabel) {
              state.accounts[index].labels[txid] = {
                label,
                ref: txid,
                type: 'tx'
              }

              if (txIndex !== -1) {
                state.accounts[index].transactions[txIndex].label = label

                // also store label in vout property of transaction model
                if (state.accounts[index].transactions[txIndex].vout[vout]) {
                  state.accounts[index].transactions[txIndex].vout[vout].label =
                    label
                }

                // also store label in vin property of transaction model
                const inputIndex = state.accounts[index].transactions[
                  txIndex
                ].vin.findIndex(
                  (input: Transaction['vin'][number]) =>
                    input.previousOutput.txid === txid &&
                    input.previousOutput.vout === vout
                )
                if (inputIndex !== -1) {
                  state.accounts[index].transactions[txIndex].vin[
                    inputIndex
                  ].label = label
                }
              }
            }

            // UTXO's address label update
            if (address) {
              const addressHasLabel = state.accounts[index].labels[address]

              if (!addressHasLabel) {
                state.accounts[index].labels[address] = {
                  label,
                  ref: address,
                  type: 'addr'
                }

                if (addressIndex !== -1) {
                  state.accounts[index].addresses[addressIndex].label = label
                }
              }
            }
          })
        )

        return get().accounts.find((a) => a.id === accountId)
      },
      tags: [],
      updateAccount: (account) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (_account) => _account.id === account.id
            )
            if (index !== -1) {
              // Merge labels from current state with incoming account to prevent
              // race condition where Nostr labels are overwritten by wallet sync
              const currentLabels = state.accounts[index].labels || {}
              const incomingLabels = account.labels || {}
              const mergedLabels = { ...incomingLabels, ...currentLabels }

              state.accounts[index] = {
                ...account,
                labels: mergedLabels
              }

              // Re-apply merged labels to transactions, utxos, and addresses
              for (const [ref, labelObj] of Object.entries(mergedLabels)) {
                if (labelObj.type === 'tx') {
                  const txIndex = state.accounts[index].transactions.findIndex(
                    (tx: Transaction) => tx.id === ref
                  )
                  if (txIndex !== -1) {
                    state.accounts[index].transactions[txIndex].label =
                      labelObj.label
                  }
                } else if (labelObj.type === 'output') {
                  const utxoIndex = state.accounts[index].utxos.findIndex(
                    (utxo: Utxo) => getUtxoOutpoint(utxo) === ref
                  )
                  if (utxoIndex !== -1) {
                    state.accounts[index].utxos[utxoIndex].label =
                      labelObj.label
                  }
                } else if (labelObj.type === 'addr') {
                  const addrIndex = state.accounts[index].addresses.findIndex(
                    (addr: Address) => addr.address === ref
                  )
                  if (addrIndex !== -1) {
                    state.accounts[index].addresses[addrIndex].label =
                      labelObj.label
                  }
                }
              }
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
            if (index !== -1) {
              state.accounts[index].name = newName
            }
          })
        )
      },
      updateAccountNostr: (id, nostr) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.id === id
            )
            if (index === -1) {
              return
            }
            state.accounts[index].nostr = {
              ...state.accounts[index].nostr,
              ...nostr
            }
          })
        )
      },
      updateKeyName: (id, keyIndex, newName) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.id === id
            )
            if (index === -1) {
              return
            }
            state.accounts[index].keys[keyIndex].name = newName
          })
        )
      }
    }),
    {
      name: 'satsigner-accounts',
      onRehydrateStorage: () => (state) => {
        // Convert string dates back to Date objects after rehydration
        if (state?.accounts) {
          for (const account of state.accounts) {
            if (account.createdAt && typeof account.createdAt === 'string') {
              account.createdAt = new Date(account.createdAt)
            }
            if (
              account.lastSyncedAt &&
              typeof account.lastSyncedAt === 'string'
            ) {
              account.lastSyncedAt = new Date(account.lastSyncedAt)
            }
            if (
              account.nostr?.lastUpdated &&
              typeof account.nostr.lastUpdated === 'string'
            ) {
              account.nostr.lastUpdated = new Date(account.nostr.lastUpdated)
            }
            if (
              account.nostr?.syncStart &&
              typeof account.nostr.syncStart === 'string'
            ) {
              account.nostr.syncStart = new Date(account.nostr.syncStart)
            }
          }
        }
      },
      partialize: (state) => state,
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useAccountsStore }
