import { type Draft } from 'immer'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

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
import { deleteAllKeySecrets, deleteKeySecret } from '@/storage/encrypted'
import { type Label } from '@/types/bips/329'
import {
  type Account,
  type Key,
  type SyncProgress,
  type SyncStatus
} from '@/types/models/Account'
import { type NostrAccount } from '@/types/models/Nostr'
import { type Transaction } from '@/types/models/Transaction'
import { dropSeedFromKey } from '@/utils/account'
import {
  deleteNostrAccountSecretSafe,
  mergeAccountWithCachedNostrSecrets,
  persistAccountSecretsSafe,
  setCachedAccountSecrets
} from '@/utils/nostrSecrets'
import { pruneExcludedOutpoints } from '@/utils/utxoList'

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
  setAccounts: (accounts: Account[]) => void
  addAccount: (account: Account) => void
  updateAccount: (account: Account) => void
  updateAccountName: (id: Account['id'], newName: string) => void
  updateKeyName: (id: Account['id'], keyIndex: number, newName: string) => void
  updateAccountNostr: (
    id: Account['id'],
    nostr: Partial<Account['nostr']>
  ) => void
  markDmsAsRead: (id: Account['id']) => void
  updateAccountBirthday: (id: Account['id'], date: Date | undefined) => void
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
  excludeUtxoOutpoints: (accountId: Account['id'], outpoints: string[]) => void
  includeUtxoOutpoints: (accountId: Account['id'], outpoints: string[]) => void
}

type ImmerSet = (fn: (state: Draft<AccountsState>) => void) => void

/**
 * Reload a single account from SQLite and update Zustand state.
 * Used after SQL mutations that change account data.
 */
function reloadAccount(set: ImmerSet, accountId: string): Account | undefined {
  const account = getAccountById(accountId)
  if (!account) {
    return undefined
  }

  const withSecrets = mergeAccountWithCachedNostrSecrets(account)

  set((state) => {
    const idx = state.accounts.findIndex((a) => a.id === accountId)
    if (idx !== -1) {
      state.accounts[idx] = withSecrets
    }
  })
  return withSecrets
}

const useAccountsStore = create<AccountsState & AccountsAction>()(
  immer((set, get) => ({
    accounts: getAccounts().map(mergeAccountWithCachedNostrSecrets),
    addAccount: (account) => {
      void persistAccountSecretsSafe(account.id, account.nostr)
      insertAccountDb(account)
      set((state) => {
        state.accounts.push(account)
      })
    },
    deleteAccount: (id) => {
      const account = get().accounts.find((a) => a.id === id)
      if (account) {
        deleteAllKeySecrets(account.id, account.keys.length)
        void deleteNostrAccountSecretSafe(account.id)
      }
      deleteAccountDb(id)
      set((state) => {
        const index = state.accounts.findIndex((a) => a.id === id)
        if (index !== -1) {
          state.accounts.splice(index, 1)
        }
      })
    },
    deleteAccounts: () => {
      const { accounts } = get()
      for (const account of accounts) {
        deleteAllKeySecrets(account.id, account.keys.length)
        void deleteNostrAccountSecretSafe(account.id)
      }
      deleteAllAccountsDb()
      set((state) => {
        state.accounts = []
      })
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
        const newKey = await dropSeedFromKey(
          accountId,
          account.keys[keyIndex],
          keyIndex
        )
        const updatedKeys = [...account.keys]
        updatedKeys[keyIndex] = newKey
        updateAccountKeysDb(accountId, updatedKeys)

        set((state) => {
          const accountIndex = state.accounts.findIndex(
            (acc) => acc.id === accountId
          )
          if (accountIndex === -1) {
            throw new Error('Account not found')
          }
          state.accounts[accountIndex].keys[keyIndex] = newKey
        })
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
    excludeUtxoOutpoints: (accountId, outpoints) => {
      const account = get().accounts.find((entry) => entry.id === accountId)
      if (!account || outpoints.length === 0) {
        return
      }

      const next = account.excludedUtxoOutpoints
        ? new Set(account.excludedUtxoOutpoints)
        : new Set<string>()
      for (const outpoint of outpoints) {
        next.add(outpoint)
      }
      const excludedUtxoOutpoints = pruneExcludedOutpoints(
        Array.from(next),
        account.utxos
      )
      const updatedAccount: Account = {
        ...account,
        excludedUtxoOutpoints
      }
      updateFullAccountDb(updatedAccount)
      set((state) => {
        const index = state.accounts.findIndex(
          (entry) => entry.id === accountId
        )
        if (index !== -1) {
          state.accounts[index].excludedUtxoOutpoints = excludedUtxoOutpoints
        }
      })
    },
    getTags: () => get().tags,
    importLabels: (accountId: string, labels: Label[]) => {
      const labelsAdded = importLabelsDb(accountId, labels)
      reloadAccount(set, accountId)
      return labelsAdded
    },
    includeUtxoOutpoints: (accountId, outpoints) => {
      const account = get().accounts.find((entry) => entry.id === accountId)
      if (!account || outpoints.length === 0) {
        return
      }

      const remove = new Set(outpoints)
      const excludedUtxoOutpoints = (
        account.excludedUtxoOutpoints ?? []
      ).filter((outpoint) => !remove.has(outpoint))
      const updatedAccount: Account = {
        ...account,
        excludedUtxoOutpoints
      }
      updateFullAccountDb(updatedAccount)
      set((state) => {
        const index = state.accounts.findIndex(
          (entry) => entry.id === accountId
        )
        if (index !== -1) {
          state.accounts[index].excludedUtxoOutpoints = excludedUtxoOutpoints
        }
      })
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
      set((state) => {
        state.accounts[accountIndex].transactions[txIndex] = tx
      })
    },
    markDmsAsRead: (id) => {
      markDmsAsReadDb(id)
      set((state) => {
        const index = state.accounts.findIndex((account) => account.id === id)
        if (index === -1 || !state.accounts[index].nostr) {
          return
        }
        state.accounts[index].nostr.dms = state.accounts[index].nostr.dms.map(
          (dm) => (dm.read === false ? { ...dm, read: true } : dm)
        )
      })
    },
    resetKey: (accountId, keyIndex) => {
      const resetKeyData: Key = {
        creationType: undefined as unknown as Key['creationType'],
        fingerprint: undefined,
        index: keyIndex,
        iv: '',
        mnemonicWordCount: undefined,
        name: '',
        scriptVersion: undefined,
        secret: ''
      }

      const account = get().accounts.find((a) => a.id === accountId)
      if (!account) {
        return
      }

      deleteKeySecret(accountId, keyIndex)
      const updatedKeys = [...account.keys]
      updatedKeys[keyIndex] = resetKeyData
      updateAccountKeysDb(accountId, updatedKeys)

      set((state) => {
        const accountIndex = state.accounts.findIndex(
          (acc) => acc.id === accountId
        )
        if (accountIndex === -1) {
          return
        }
        state.accounts[accountIndex].keys[keyIndex] = resetKeyData
      })
    },
    setAccounts: (accounts) => {
      // TODO: setAccountsDb
      set((state) => {
        state.accounts = accounts
      })
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
      set((state) => {
        const index = state.accounts.findIndex((account) => account.id === id)
        if (index !== -1) {
          state.accounts[index].lastSyncedAt = date
        }
      })
    },
    setSyncProgress: (id, syncProgress) => {
      updateSyncProgressDb(id, syncProgress)
      set((state) => {
        const index = state.accounts.findIndex((account) => account.id === id)
        if (index !== -1) {
          state.accounts[index].syncProgress = {
            ...syncProgress
          }
        }
      })
    },
    setSyncStatus: (id, syncStatus) => {
      updateSyncStatusDb(id, syncStatus)
      set((state) => {
        const index = state.accounts.findIndex((account) => account.id === id)
        if (index !== -1) {
          state.accounts[index].syncStatus = syncStatus
        }
      })
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

      const excludedUtxoOutpoints = pruneExcludedOutpoints(
        currentAccount.excludedUtxoOutpoints ??
          account.excludedUtxoOutpoints ??
          [],
        account.utxos
      )

      const mergedAccount: Account = {
        ...account,
        excludedUtxoOutpoints,
        labels: mergedLabels,
        nostr: mergedNostr
      }

      void persistAccountSecretsSafe(mergedAccount.id, mergedAccount.nostr)
      updateFullAccountDb(mergedAccount)

      reloadAccount(set, account.id)
    },
    updateAccountBirthday: (id, date) => {
      const account = get().accounts.find((a) => a.id === id)
      if (!account) {
        return
      }

      const prevTime = account.birthdayDate?.getTime()
      const nextTime = date?.getTime()
      if (prevTime === nextTime) {
        return
      }

      // Clearing the RPC checkpoint forces the next sync to rescan from the
      // new birthday instead of continuing incrementally from the old range.
      const updatedAccount: Account = {
        ...account,
        birthdayDate: date,
        rpcLastBlockHash: undefined
      }
      updateFullAccountDb(updatedAccount)

      set((state) => {
        const index = state.accounts.findIndex((a) => a.id === id)
        if (index !== -1) {
          state.accounts[index].birthdayDate = date
          state.accounts[index].rpcLastBlockHash = undefined
        }
      })
    },
    updateAccountName: (id, newName) => {
      updateAccountNameDb(id, newName)
      set((state) => {
        const index = state.accounts.findIndex((account) => account.id === id)
        if (index !== -1) {
          state.accounts[index].name = newName
        }
      })
    },
    updateAccountNostr: (id, nostr) => {
      const prev = get().accounts.find((account) => account.id === id)?.nostr
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
      const nextNostr: NostrAccount = {
        ...base,
        ...nostr
      }

      if (
        nostr.commonNsec !== undefined ||
        nostr.deviceNsec !== undefined ||
        nostr.deviceMnemonic !== undefined
      ) {
        setCachedAccountSecrets(id, {
          commonNsec: nextNostr.commonNsec || '',
          deviceMnemonic: nextNostr.deviceMnemonic,
          deviceNsec: nextNostr.deviceNsec
        })
        void persistAccountSecretsSafe(id, nextNostr)
      }

      updateAccountNostrDb(id, nostr)
      set((state) => {
        const index = state.accounts.findIndex((account) => account.id === id)
        if (index === -1) {
          return
        }
        state.accounts[index].nostr = nextNostr
      })
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

      set((state) => {
        const index = state.accounts.findIndex((account) => account.id === id)
        if (index === -1) {
          return
        }
        state.accounts[index].keys[keyIndex].name = newName
      })
    }
  }))
)

export { useAccountsStore }
