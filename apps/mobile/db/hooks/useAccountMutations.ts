import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type Account } from '@/types/models/Account'
import { type NostrAccount } from '@/types/models/Nostr'

import {
  accountKeys,
  addressKeys,
  labelKeys,
  nostrKeys,
  transactionKeys,
  utxoKeys
} from '../keys'
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
} from '../mutations/accounts'
import { updateAccountNostr as updateAccountNostrDb } from '../mutations/nostr'

function useAddAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (account: Account) => {
      insertAccountDb(account)
      return Promise.resolve()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all })
    }
  })
}

function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (account: Account) => {
      updateFullAccountDb(account)
      return Promise.resolve()
    },
    onSuccess: (_, account) => {
      queryClient.invalidateQueries({
        queryKey: accountKeys.detail(account.id)
      })
      queryClient.invalidateQueries({
        queryKey: transactionKeys.all(account.id)
      })
      queryClient.invalidateQueries({ queryKey: utxoKeys.all(account.id) })
      queryClient.invalidateQueries({ queryKey: addressKeys.all(account.id) })
      queryClient.invalidateQueries({ queryKey: labelKeys.all(account.id) })
      queryClient.invalidateQueries({ queryKey: nostrKeys.dms(account.id) })
    }
  })
}

function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      deleteAccountDb(id)
      return Promise.resolve()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all })
    }
  })
}

function useDeleteAllAccounts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => {
      deleteAllAccountsDb()
      return Promise.resolve()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all })
    }
  })
}

function useUpdateAccountName() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => {
      updateAccountNameDb(id, name)
      return Promise.resolve()
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.detail(id) })
    }
  })
}

function useUpdateAccountNostr() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      nostr
    }: {
      id: string
      nostr: Partial<NostrAccount>
    }) => {
      updateAccountNostrDb(id, nostr)
      return Promise.resolve()
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: nostrKeys.dms(id) })
      queryClient.invalidateQueries({ queryKey: nostrKeys.relays(id) })
    }
  })
}

function useUpdateSyncStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status
    }: {
      id: string
      status: Account['syncStatus']
    }) => {
      updateSyncStatusDb(id, status)
      return Promise.resolve()
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.detail(id) })
    }
  })
}

function useUpdateSyncProgress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      progress
    }: {
      id: string
      progress: NonNullable<Account['syncProgress']>
    }) => {
      updateSyncProgressDb(id, progress)
      return Promise.resolve()
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.detail(id) })
    }
  })
}

function useUpdateLastSyncedAt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, date }: { id: string; date: Date }) => {
      updateLastSyncedAtDb(id, date)
      return Promise.resolve()
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.detail(id) })
    }
  })
}

function useUpdateAccountKeys() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, keys }: { id: string; keys: Account['keys'] }) => {
      updateAccountKeysDb(id, keys)
      return Promise.resolve()
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.detail(id) })
    }
  })
}

export {
  useAddAccount,
  useDeleteAccount,
  useDeleteAllAccounts,
  useUpdateAccount,
  useUpdateAccountKeys,
  useUpdateAccountName,
  useUpdateAccountNostr,
  useUpdateLastSyncedAt,
  useUpdateSyncProgress,
  useUpdateSyncStatus
}
