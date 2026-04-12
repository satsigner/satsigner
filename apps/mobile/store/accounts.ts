import { produce } from 'immer'
import { create } from 'zustand'

import {
  deleteAccount as deleteAccountDb,
  deleteAllAccounts as deleteAllAccountsDb,
  insertAccount as insertAccountDb,
  updateAccountKeys as updateAccountKeysDb,
  updateAccountName as updateAccountNameDb,
  updateFullAccount as updateFullAccountDb,
  updateLastSyncedAt as updateLastSyncedAtDb,
  updateSyncProgress as updateSyncProgressDb,
  updateSyncStatus as updateSyncStatusDb
} from '@/db/mutations/accounts'
import {
  cascadeAddrLabel,
  cascadeTxLabel,
  cascadeUtxoLabel,
  importLabels as importLabelsDb
} from '@/db/mutations/labels'
import {
  markDmsAsRead as markDmsAsReadDb,
  updateAccountNostr as updateAccountNostrDb
} from '@/db/mutations/nostr'
import {
  deleteTags as deleteTagsDb,
  getTags as getTagsDb,
  setTags as setTagsDb
} from '@/db/mutations/tags'
import { upsertSingleTransaction } from '@/db/mutations/transactions'
import { getAccountById, getAccounts } from '@/db/queries/accounts'
import {
  type Account,
  type Key,
  type SyncProgress,
  type SyncStatus
} from '@/types/models/Account'
import { type NostrAccount } from '@/types/models/Nostr'
import { type Transaction } from '@/types/models/Transaction'
import { dropSeedFromKey } from '@/utils/account'
import { type Label } from '@/utils/bip329'

/**
 * Wallet sync and address refresh call updateAccount with { ...account, ... } from
 * React state; that snapshot can omit Nostr keys saved a moment earlier. Prefer
 * non-empty Nostr secrets/ids from the store when the incoming payload has blanks.
 */
function mergeNostrForFullAccountReplace(
  existing: NostrAccount,
  incoming: NostrAccount
): NostrAccount {
  return {
    ...existing,
    ...incoming,
    commonNpub: incoming.commonNpub || existing.commonNpub || '',
    commonNsec: incoming.commonNsec || existing.commonNsec || '',
    deviceNpub: incoming.deviceNpub || existing.deviceNpub || '',
    deviceNsec: incoming.deviceNsec || existing.deviceNsec || ''
  }
}

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
  dropSeedFromKey: (
    accountId: Account['id'],
    keyIndex: number
  ) => Promise<{ success: boolean; message: string }>
  resetKey: (accountId: Account['id'], keyIndex: number) => void
}

/**
 * Reload a single account from SQLite and update Zustand state.
 * Used after SQL mutations that change account data.
 */
function reloadAccount(
  set: (fn: (state: AccountsState) => Partial<AccountsState>) => void,
  accountId: string
): Account | undefined {
  const account = getAccountById(accountId)
  if (!account) {
    return undefined
  }

  set(
    produce((state: AccountsState) => {
      const idx = state.accounts.findIndex((a) => a.id === accountId)
      if (idx !== -1) {
        state.accounts[idx] = account
      }
    })
  )
  return account
}

const useAccountsStore = create<AccountsState & AccountsAction>()(
  (set, get) => ({
    accounts: getAccounts(),
    addAccount: (account) => {
      insertAccountDb(account)
      set(
        produce((state: AccountsState) => {
          state.accounts.push(account)
        })
      )
    },
    deleteAccount: (id) => {
      deleteAccountDb(id)
      set(
        produce((state: AccountsState) => {
          const index = state.accounts.findIndex((account) => account.id === id)
          if (index !== -1) {
            state.accounts.splice(index, 1)
          }
        })
      )
    },
    deleteAccounts: () => {
      deleteAllAccountsDb()
      set(() => ({ accounts: [] }))
    },
    deleteTags: () => {
      deleteTagsDb()
      set({ tags: [] })
    },
    dropSeedFromKey: async (accountId, keyIndex) => {
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
        const updatedKeys = [...account.keys]
        updatedKeys[keyIndex] = newKey
        updateAccountKeysDb(accountId, updatedKeys)

        set(
          produce((state) => {
            const accountIndex = state.accounts.findIndex(
              (acc: Account) => acc.id === accountId
            )
            if (accountIndex === -1) {
              throw new Error('Account not found')
            }
            state.accounts[accountIndex].keys[keyIndex] = newKey
          })
        )
        return {
          message: 'Seed dropped successfully',
          success: true
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown reason'
        return {
          message: `Failed to drop seed: ${reason}`,
          success: false
        }
      }
    },
    getTags: () => get().tags,
    importLabels: (accountId: string, labels: Label[]) => {
      const labelsAdded = importLabelsDb(accountId, labels)
      reloadAccount(set, accountId)
      return labelsAdded
    },
    loadTx: (accountId, tx) => {
      const { accounts } = get()
      const accountIndex = accounts.findIndex(
        (account) => account.id === accountId
      )

      if (accountIndex === -1) {
        return
      }

      const account = accounts[accountIndex]
      const txIndex = account.transactions.findIndex((t) => t.id === tx.id)

      if (txIndex === -1) {
        return
      }

      upsertSingleTransaction(accountId, tx)
      set(
        produce((state) => {
          state.accounts[accountIndex].transactions[txIndex] = tx
        })
      )
    },
    markDmsAsRead: (id) => {
      markDmsAsReadDb(id)
      set(
        produce((state: AccountsState) => {
          const index = state.accounts.findIndex((account) => account.id === id)
          if (index === -1 || !state.accounts[index].nostr) {
            return
          }
          state.accounts[index].nostr.dms = state.accounts[index].nostr.dms.map(
            (dm) => (dm.read === false ? { ...dm, read: true } : dm)
          )
        })
      )
    },
    resetKey: (accountId, keyIndex) => {
      const resetKeyData: Key = {
        creationType: undefined as unknown as Key['creationType'],
        fingerprint: undefined,
        index: keyIndex,
        iv: undefined as unknown as string,
        mnemonicWordCount: undefined,
        name: '',
        scriptVersion: undefined,
        secret: undefined as unknown as Key['secret']
      }

      const account = get().accounts.find((a) => a.id === accountId)
      if (!account) {
        return
      }

      const updatedKeys = [...account.keys]
      updatedKeys[keyIndex] = resetKeyData
      updateAccountKeysDb(accountId, updatedKeys)

      set(
        produce((state) => {
          const accountIndex = state.accounts.findIndex(
            (acc: Account) => acc.id === accountId
          )
          if (accountIndex === -1) {
            return
          }
          state.accounts[accountIndex].keys[keyIndex] = resetKeyData
        })
      )
    },
    setAddrLabel: (accountId, addr, label) => {
      const account = get().accounts.find((account) => account.id === accountId)
      if (!account) {
        return undefined
      }

      cascadeAddrLabel(accountId, addr, label)
      return reloadAccount(set, accountId)
    },
    setLastSyncedAt: (id, date) => {
      updateLastSyncedAtDb(id, date)
      set(
        produce((state: AccountsState) => {
          const index = state.accounts.findIndex((account) => account.id === id)
          if (index !== -1) {
            state.accounts[index].lastSyncedAt = date
          }
        })
      )
    },
    setSyncProgress: (id, syncProgress) => {
      updateSyncProgressDb(id, syncProgress)
      set(
        produce((state: AccountsState) => {
          const index = state.accounts.findIndex((account) => account.id === id)
          if (index !== -1) {
            state.accounts[index].syncProgress = {
              ...syncProgress
            }
          }
        })
      )
    },
    setSyncStatus: (id, syncStatus) => {
      updateSyncStatusDb(id, syncStatus)
      set(
        produce((state: AccountsState) => {
          const index = state.accounts.findIndex((account) => account.id === id)
          if (index !== -1) {
            state.accounts[index].syncStatus = syncStatus
          }
        })
      )
    },
    setTags: (tags: string[]) => {
      setTagsDb(tags)
      set({ tags })
    },
    setTxLabel: (accountId, txid, label) => {
      const account = get().accounts.find((account) => account.id === accountId)
      if (!account) {
        return undefined
      }

      cascadeTxLabel(accountId, txid, label)
      return reloadAccount(set, accountId)
    },
    setUtxoLabel: (accountId, txid, vout, label) => {
      const account = get().accounts.find((account) => account.id === accountId)
      if (!account) {
        return undefined
      }

      cascadeUtxoLabel(accountId, txid, vout, label)
      return reloadAccount(set, accountId)
    },
    tags: getTagsDb(),
    updateAccount: (account) => {
      // Merge labels from current state with incoming account to prevent
      // race condition where Nostr labels are overwritten by wallet sync
      const currentAccount = get().accounts.find((a) => a.id === account.id)
      if (!currentAccount) {
        return
      }

      const currentLabels = currentAccount.labels || {}
      const incomingLabels = account.labels || {}
      const mergedLabels = { ...incomingLabels, ...currentLabels }

      const mergedNostr = mergeNostrForFullAccountReplace(
        currentAccount.nostr,
        account.nostr
      )

      const mergedAccount: Account = {
        ...account,
        labels: mergedLabels,
        nostr: mergedNostr
      }

      // Write to SQLite
      updateFullAccountDb(mergedAccount)

      // Reload from SQLite to get consistent state with labels applied
      reloadAccount(set, account.id)
    },
    updateAccountName: (id, newName) => {
      updateAccountNameDb(id, newName)
      set(
        produce((state: AccountsState) => {
          const index = state.accounts.findIndex((account) => account.id === id)
          if (index !== -1) {
            state.accounts[index].name = newName
          }
        })
      )
    },
    updateAccountNostr: (id, nostr) => {
      updateAccountNostrDb(id, nostr)
      set(
        produce((state: AccountsState) => {
          const index = state.accounts.findIndex((account) => account.id === id)
          if (index === -1) {
            return
          }
          const prev = state.accounts[index].nostr
          const base: NostrAccount = prev ?? {
            autoSync: false,
            commonNpub: '',
            commonNsec: '',
            dms: [],
            lastUpdated: new Date(),
            relays: [],
            syncStart: new Date(),
            trustedMemberDevices: []
          }
          state.accounts[index].nostr = {
            ...base,
            ...nostr
          }
        })
      )
    },
    updateKeyName: (id, keyIndex, newName) => {
      const account = get().accounts.find((a) => a.id === id)
      if (!account) {
        return
      }

      const updatedKeys = [...account.keys]
      if (updatedKeys[keyIndex]) {
        updatedKeys[keyIndex] = { ...updatedKeys[keyIndex], name: newName }
        updateAccountKeysDb(id, updatedKeys)
      }

      set(
        produce((state: AccountsState) => {
          const index = state.accounts.findIndex((account) => account.id === id)
          if (index === -1) {
            return
          }
          state.accounts[index].keys[keyIndex].name = newName
        })
      )
    }
  })
)

export { useAccountsStore }
