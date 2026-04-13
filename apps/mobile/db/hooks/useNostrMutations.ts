import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type NostrDM } from '@/types/models/Nostr'

import { accountKeys, nostrKeys } from '../keys'
import {
  insertDm as insertDmDb,
  markDmsAsRead as markDmsAsReadDb,
  upsertRelays as upsertRelaysDb
} from '../mutations/nostr'

function useMarkDmsAsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (accountId: string) => {
      markDmsAsReadDb(accountId)
      return Promise.resolve()
    },
    onSuccess: (_, accountId) => {
      queryClient.invalidateQueries({ queryKey: nostrKeys.dms(accountId) })
      queryClient.invalidateQueries({
        queryKey: accountKeys.detail(accountId)
      })
    }
  })
}

function useInsertDm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ accountId, dm }: { accountId: string; dm: NostrDM }) => {
      insertDmDb(accountId, dm)
      return Promise.resolve()
    },
    onSuccess: (_, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: nostrKeys.dms(accountId) })
    }
  })
}

function useUpsertRelays() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      accountId,
      relays
    }: {
      accountId: string
      relays: string[]
    }) => {
      upsertRelaysDb(accountId, relays)
      return Promise.resolve()
    },
    onSuccess: (_, { accountId }) => {
      queryClient.invalidateQueries({
        queryKey: nostrKeys.relays(accountId)
      })
      queryClient.invalidateQueries({
        queryKey: accountKeys.detail(accountId)
      })
    }
  })
}

export { useInsertDm, useMarkDmsAsRead, useUpsertRelays }
