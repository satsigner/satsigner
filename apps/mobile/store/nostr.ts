import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import {
  clearNostrProcessedEvents,
  markNostrEventsProcessed
} from '@/db/nostrProcessedEvents'
import mmkvStorage from '@/storage/mmkv'
import { gray } from '@/styles/colors'
import { type NostrErrorCode } from '@/types/models/Nostr'
import { generateColorFromNpub } from '@/utils/nostr'
import { isRecord } from '@/utils/object'
import { type TransactionData } from '@/utils/psbt'

type Member = {
  npub: string
  color: string
}

type NostrProfile = {
  displayName?: string
  fetchedAt?: number
  picture?: string
}

// Sync status for tracking per-account sync state
type SyncStatus = 'idle' | 'connecting' | 'syncing' | 'error'

interface NostrSyncStatus {
  status: SyncStatus
  lastError?: NostrErrorCode
  lastSyncAt?: number
  messagesReceived: number
  messagesProcessed: number
}

const DEFAULT_SYNC_STATUS: NostrSyncStatus = {
  messagesProcessed: 0,
  messagesReceived: 0,
  status: 'idle'
}

const PERSIST_VERSION = 2

/** SQLite dedupe rows; a failure must not block clearing the store state. */
function clearProcessedEventsSafely(accountId?: string): void {
  try {
    clearNostrProcessedEvents(accountId)
  } catch {
    // Leftover rows only skip already-seen events on a later sync.
  }
}

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key))
}

/**
 * v1 kept processed event ids in MMKV, which re-serialized the whole store on
 * every event. They now live in SQLite; created_at is unknown for these rows.
 */
function moveProcessedEventsToSqlite(processedEvents: unknown): void {
  if (!isRecord(processedEvents)) {
    return
  }
  for (const [accountId, ids] of Object.entries(processedEvents)) {
    const idList = Array.isArray(ids)
      ? ids.filter((id) => typeof id === 'string')
      : Object.keys(isRecord(ids) ? ids : {})
    markNostrEventsProcessed(
      accountId,
      idList.map((id) => ({ createdAt: 0, id }))
    )
  }
}

function migrateNostrPersistedState(
  persistedState: unknown,
  version: number
): Record<string, unknown> {
  if (!isRecord(persistedState)) {
    return {}
  }
  if (version >= PERSIST_VERSION) {
    return persistedState
  }
  try {
    moveProcessedEventsToSqlite(persistedState.processedEvents)
  } catch {
    // Dropping dedupe state only costs a re-process; handlers are idempotent.
  }
  return Object.fromEntries(
    Object.entries(persistedState).filter(
      ([key]) => key !== 'processedEvents' && key !== 'processedMessageIds'
    )
  )
}

type NostrState = {
  members: Record<string, Member[]>
  profiles: Record<string, NostrProfile>
  lastProtocolEOSE: Record<string, number>
  lastDataExchangeEOSE: Record<string, number>
  trustedDevices: Record<string, string[]>
  syncStatus: Record<string, NostrSyncStatus>
  syncingAccounts: Record<string, boolean>
  transactionToShare: {
    transaction: string
    transactionData: TransactionData
  } | null
}

type NostrAction = {
  setProfile: (npub: string, profile: NostrProfile) => void
  getProfile: (npub: string) => NostrProfile | undefined
  addMember: (accountId: string, npub: string) => void
  removeMember: (accountId: string, npub: string) => void
  getMembers: (accountId: string) => Member[]
  clearAllNostrState: () => void
  clearNostrState: (accountId: string) => void
  removeAccountNostrState: (accountId: string) => void
  clearProcessedEvents: (accountId: string) => void
  setLastProtocolEOSE: (accountId: string, timestamp: number) => void
  setLastDataExchangeEOSE: (accountId: string, timestamp: number) => void
  getLastProtocolEOSE: (accountId: string) => number | undefined
  getLastDataExchangeEOSE: (accountId: string) => number | undefined
  addTrustedDevice: (accountId: string, deviceNpub: string) => void
  removeTrustedDevice: (accountId: string, deviceNpub: string) => void
  getTrustedDevices: (accountId: string) => string[]
  setSyncStatus: (accountId: string, status: Partial<NostrSyncStatus>) => void
  getSyncStatus: (accountId: string) => NostrSyncStatus
  incrementMessagesReceived: (accountId: string, count?: number) => void
  incrementMessagesProcessed: (accountId: string, count?: number) => void
  setSyncing: (accountId: string, isSyncing: boolean) => void
  isSyncing: (accountId: string) => boolean
  setTransactionToShare: (
    data: { transaction: string; transactionData: TransactionData } | null
  ) => void
}

const useNostrStore = create<NostrState & NostrAction>()(
  persist(
    (set, get) => ({
      addMember: (accountId, npub) => {
        try {
          // Check if member already exists BEFORE generating color (expensive)
          const existingMembers = get().members[accountId] || []
          const alreadyExists = existingMembers.some(
            (m) => (typeof m === 'string' ? m : m.npub) === npub
          )
          if (alreadyExists) {
            return
          }

          const color = generateColorFromNpub(npub)

          set((state) => {
            const currentMembers = state.members[accountId] || []
            const normalizedMembers = currentMembers.map((member) =>
              typeof member === 'string'
                ? { color: gray[500], npub: member }
                : member
            )

            // Double-check in case another call added this member
            const existingNpubs = new Set(normalizedMembers.map((m) => m.npub))
            if (!existingNpubs.has(npub)) {
              normalizedMembers.push({ color, npub })
            }

            return {
              members: {
                ...state.members,
                [accountId]: normalizedMembers
              }
            }
          })
        } catch {
          set((state) => {
            const existingMembers = state.members[accountId] || []
            const normalizedMembers = existingMembers.map((member) =>
              typeof member === 'string'
                ? { color: gray[500], npub: member }
                : member
            )

            const existingNpubs = new Set(normalizedMembers.map((m) => m.npub))
            if (!existingNpubs.has(npub)) {
              normalizedMembers.push({ color: gray[500], npub })
            }

            const newState = {
              ...state,
              members: {
                ...state.members,
                [accountId]: normalizedMembers
              }
            }
            return newState
          })
        }
      },
      addTrustedDevice: (accountId, deviceNpub) => {
        set((state) => {
          const currentDevices = state.trustedDevices[accountId] || []
          if (!currentDevices.includes(deviceNpub)) {
            return {
              trustedDevices: {
                ...state.trustedDevices,
                [accountId]: [...currentDevices, deviceNpub]
              }
            }
          }
          return state
        })
      },
      clearAllNostrState: () => {
        clearProcessedEventsSafely()
        set({
          lastDataExchangeEOSE: {},
          lastProtocolEOSE: {},
          members: {},
          profiles: {},
          syncStatus: {},
          syncingAccounts: {},
          transactionToShare: null,
          trustedDevices: {}
        })
      },
      clearNostrState: (accountId) => {
        clearProcessedEventsSafely(accountId)
        set((state) => ({
          lastDataExchangeEOSE: {
            ...state.lastDataExchangeEOSE,
            [accountId]: 0
          },
          lastProtocolEOSE: {
            ...state.lastProtocolEOSE,
            [accountId]: 0
          },
          members: {
            ...state.members,
            [accountId]: []
          },
          syncStatus: {
            ...state.syncStatus,
            [accountId]: DEFAULT_SYNC_STATUS
          },
          trustedDevices: {
            ...state.trustedDevices,
            [accountId]: []
          }
        }))
      },
      clearProcessedEvents: (accountId) => {
        clearProcessedEventsSafely(accountId)
      },
      getLastDataExchangeEOSE: (accountId) =>
        get().lastDataExchangeEOSE[accountId],
      getLastProtocolEOSE: (accountId) => get().lastProtocolEOSE[accountId],
      getMembers: (accountId) => get().members[accountId] || [],
      getProfile: (npub) => get().profiles[npub],
      getSyncStatus: (accountId) =>
        get().syncStatus[accountId] || DEFAULT_SYNC_STATUS,
      getTrustedDevices: (accountId) => get().trustedDevices[accountId] || [],
      incrementMessagesProcessed: (accountId, count = 1) => {
        set((state) => {
          const currentStatus =
            state.syncStatus[accountId] || DEFAULT_SYNC_STATUS
          return {
            syncStatus: {
              ...state.syncStatus,
              [accountId]: {
                ...currentStatus,
                messagesProcessed: currentStatus.messagesProcessed + count
              }
            }
          }
        })
      },
      incrementMessagesReceived: (accountId, count = 1) => {
        set((state) => {
          const currentStatus =
            state.syncStatus[accountId] || DEFAULT_SYNC_STATUS
          return {
            syncStatus: {
              ...state.syncStatus,
              [accountId]: {
                ...currentStatus,
                messagesReceived: currentStatus.messagesReceived + count
              }
            }
          }
        })
      },
      isSyncing: (accountId) => get().syncingAccounts[accountId] || false,
      lastDataExchangeEOSE: {},
      lastProtocolEOSE: {},
      members: {},
      profiles: {},
      removeAccountNostrState: (accountId) => {
        clearProcessedEventsSafely(accountId)
        set((state) => ({
          lastDataExchangeEOSE: omitKey(state.lastDataExchangeEOSE, accountId),
          lastProtocolEOSE: omitKey(state.lastProtocolEOSE, accountId),
          members: omitKey(state.members, accountId),
          syncStatus: omitKey(state.syncStatus, accountId),
          syncingAccounts: omitKey(state.syncingAccounts, accountId),
          trustedDevices: omitKey(state.trustedDevices, accountId)
        }))
      },
      removeMember: (accountId, npub) => {
        set((state) => {
          const currentMembers = state.members[accountId] || []
          return {
            members: {
              ...state.members,
              [accountId]: currentMembers.filter((m) => m.npub !== npub)
            }
          }
        })
      },
      removeTrustedDevice: (accountId, deviceNpub) => {
        set((state) => ({
          trustedDevices: {
            ...state.trustedDevices,
            [accountId]: (state.trustedDevices[accountId] || []).filter(
              (d) => d !== deviceNpub
            )
          }
        }))
      },
      setLastDataExchangeEOSE: (accountId, timestamp) => {
        set((state) => ({
          lastDataExchangeEOSE: {
            ...state.lastDataExchangeEOSE,
            [accountId]: timestamp
          }
        }))
      },
      setLastProtocolEOSE: (accountId, timestamp) => {
        set((state) => ({
          lastProtocolEOSE: {
            ...state.lastProtocolEOSE,
            [accountId]: timestamp
          }
        }))
      },
      setProfile: (npub, profile) => {
        set((state) => ({
          profiles: {
            ...state.profiles,
            [npub]: { ...profile, fetchedAt: profile.fetchedAt ?? Date.now() }
          }
        }))
      },
      setSyncStatus: (accountId, status) => {
        set((state) => {
          const currentStatus =
            state.syncStatus[accountId] || DEFAULT_SYNC_STATUS
          return {
            syncStatus: {
              ...state.syncStatus,
              [accountId]: { ...currentStatus, ...status }
            }
          }
        })
      },
      setSyncing: (accountId, isSyncing) => {
        set((state) => ({
          syncingAccounts: {
            ...state.syncingAccounts,
            [accountId]: isSyncing
          }
        }))
      },
      setTransactionToShare: (data) => set({ transactionToShare: data }),
      syncStatus: {},
      syncingAccounts: {},
      transactionToShare: null,
      trustedDevices: {}
    }),
    {
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(isRecord(persistedState) ? persistedState : {}),
        // Always ensure runtime-only fields start fresh on rehydration
        syncingAccounts: {},
        transactionToShare: null
      }),
      migrate: migrateNostrPersistedState,
      name: 'satsigner-nostr',
      partialize: (state) => ({
        lastDataExchangeEOSE: state.lastDataExchangeEOSE,
        lastProtocolEOSE: state.lastProtocolEOSE,
        members: state.members,
        profiles: state.profiles,
        trustedDevices: state.trustedDevices
      }),
      storage: createJSONStorage(() => mmkvStorage),
      version: PERSIST_VERSION
    }
  )
)

export { migrateNostrPersistedState, useNostrStore }
export type { NostrSyncStatus as NostrAccountSyncState }
