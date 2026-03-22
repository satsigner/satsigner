import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { NostrAPI } from '@/api/nostr'
import { MAX_PROCESSED_ITEMS } from '@/constants/nostr'
import mmkvStorage from '@/storage/mmkv'
import { gray } from '@/styles/colors'
import { generateColorFromNpub } from '@/utils/nostr'
import type { TransactionData } from '@/utils/psbt'

interface Member {
  npub: string
  color: string
}

interface NostrProfile {
  displayName?: string
  picture?: string
}

// Object-based storage for O(1) lookups (instead of arrays which require O(n) includes())
type ProcessedIdsMap = Record<string, true>

// Sync status for tracking per-account sync state
type SyncStatus = 'idle' | 'connecting' | 'syncing' | 'error'

interface NostrSyncStatus {
  status: SyncStatus
  lastError?: string
  lastSyncAt?: number
  messagesReceived: number
  messagesProcessed: number
}

const DEFAULT_SYNC_STATUS: NostrSyncStatus = {
  messagesProcessed: 0,
  messagesReceived: 0,
  status: 'idle'
}

// Prune oldest entries from a ProcessedIdsMap when it exceeds the limit
// JavaScript objects maintain insertion order for string keys, so Object.keys() returns them in order
function pruneProcessedIds(
  ids: ProcessedIdsMap,
  maxSize: number
): ProcessedIdsMap {
  const keys = Object.keys(ids)
  if (keys.length <= maxSize) {
    return ids
  }

  // Keep only the most recent entries (last maxSize keys)
  const keysToKeep = keys.slice(-maxSize)
  const pruned: ProcessedIdsMap = {}
  for (const key of keysToKeep) {
    pruned[key] = true
  }
  return pruned
}

interface NostrState {
  members: Record<string, Member[]>
  profiles: Record<string, NostrProfile>
  processedMessageIds: Record<string, ProcessedIdsMap>
  processedEvents: Record<string, ProcessedIdsMap>
  lastProtocolEOSE: Record<string, number>
  lastDataExchangeEOSE: Record<string, number>
  trustedDevices: Record<string, string[]>
  syncStatus: Record<string, NostrSyncStatus>
  activeSubscriptions: Set<NostrAPI>
  syncingAccounts: Record<string, boolean>
  transactionToShare: {
    transaction: string
    transactionData: TransactionData
  } | null
}

interface NostrAction {
  setProfile: (npub: string, profile: NostrProfile) => void
  getProfile: (npub: string) => NostrProfile | undefined
  addMember: (accountId: string, npub: string) => void
  removeMember: (accountId: string, npub: string) => void
  getMembers: (accountId: string) => Member[]
  clearAllNostrState: () => void
  clearNostrState: (accountId: string) => void
  addProcessedMessageId: (accountId: string, messageId: string) => void
  getProcessedMessageIds: (accountId: string) => string[]
  clearProcessedMessageIds: (accountId: string) => void
  addProcessedEvent: (accountId: string, eventId: string) => void
  getProcessedEvents: (accountId: string) => string[]
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
  addSubscription: (subscription: NostrAPI) => void
  clearSubscriptions: () => void
  getActiveSubscriptions: () => Set<NostrAPI>
  setSyncing: (accountId: string, isSyncing: boolean) => void
  isSyncing: (accountId: string) => boolean
  setTransactionToShare: (
    data: { transaction: string; transactionData: TransactionData } | null
  ) => void
}

const useNostrStore = create<NostrState & NostrAction>()(
  persist(
    (set, get) => ({
      activeSubscriptions: new Set<NostrAPI>(),
      addMember: async (accountId, npub) => {
        try {
          // Check if member already exists BEFORE generating color (expensive)
          const existingMembers = get().members[accountId] || []
          const alreadyExists = existingMembers.some(
            (m) => (typeof m === 'string' ? m : m.npub) === npub
          )
          if (alreadyExists) {
            return // Skip color generation for existing members
          }

          const color = await generateColorFromNpub(npub)

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
      addProcessedEvent: (accountId, eventId) => {
        set((state) => {
          const currentEvents = state.processedEvents[accountId] || {}
          if (currentEvents[eventId]) {
            return state
          }
          const updated = { ...currentEvents, [eventId]: true as const }
          const pruned = pruneProcessedIds(updated, MAX_PROCESSED_ITEMS)
          return {
            processedEvents: {
              ...state.processedEvents,
              [accountId]: pruned
            }
          }
        })
      },
      addProcessedMessageId: (accountId, messageId) => {
        set((state) => {
          const currentIds = state.processedMessageIds[accountId] || {}
          if (currentIds[messageId]) {
            return state
          }
          const updated = { ...currentIds, [messageId]: true as const }
          const pruned = pruneProcessedIds(updated, MAX_PROCESSED_ITEMS)
          return {
            processedMessageIds: {
              ...state.processedMessageIds,
              [accountId]: pruned
            }
          }
        })
      },
      addSubscription: (subscription: NostrAPI) => {
        set((state) => {
          const newSubscriptions = new Set(state.activeSubscriptions)
          newSubscriptions.add(subscription)
          return { activeSubscriptions: newSubscriptions }
        })
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
        set({
          activeSubscriptions: new Set(),
          lastDataExchangeEOSE: {},
          lastProtocolEOSE: {},
          members: {},
          processedEvents: {},
          processedMessageIds: {},
          profiles: {},
          syncStatus: {},
          syncingAccounts: {},
          transactionToShare: null,
          trustedDevices: {}
        })
      },
      clearNostrState: (accountId) => {
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
          processedEvents: {
            ...state.processedEvents,
            [accountId]: {}
          },
          processedMessageIds: {
            ...state.processedMessageIds,
            [accountId]: {}
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
        set((state) => ({
          processedEvents: {
            ...state.processedEvents,
            [accountId]: {}
          }
        }))
      },
      clearProcessedMessageIds: (accountId) => {
        set((state) => ({
          processedMessageIds: {
            ...state.processedMessageIds,
            [accountId]: {}
          }
        }))
      },
      clearSubscriptions: () => {
        set({ activeSubscriptions: new Set() })
      },
      getActiveSubscriptions: () => get().activeSubscriptions,
      getLastDataExchangeEOSE: (accountId) =>
        get().lastDataExchangeEOSE[accountId],
      getLastProtocolEOSE: (accountId) => get().lastProtocolEOSE[accountId],
      getMembers: (accountId) => get().members[accountId] || [],
      getProcessedEvents: (accountId) => {
        const eventsMap = get().processedEvents[accountId] || {}
        return Object.keys(eventsMap)
      },
      getProcessedMessageIds: (accountId) => {
        const idsMap = get().processedMessageIds[accountId] || {}
        return Object.keys(idsMap)
      },
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
      processedEvents: {},
      processedMessageIds: {},
      profiles: {},
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
            [npub]: { ...state.profiles[npub], ...profile }
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
      migrate: (persistedState, version) => {
        const state = persistedState as Record<string, unknown> & {
          processedEvents?: Record<string, ProcessedIdsMap | string[]>
          processedMessageIds?: Record<string, ProcessedIdsMap | string[]>
        }
        if (version < 1) {
          // v0 → v1: processedEvents and processedMessageIds changed from
          // string[] to Record<string, true> for O(1) deduplication lookups
          for (const field of [
            'processedEvents',
            'processedMessageIds'
          ] as const) {
            if (state[field]) {
              for (const [accountId, value] of Object.entries(state[field]!)) {
                if (Array.isArray(value)) {
                  state[field]![accountId] = Object.fromEntries(
                    value.map((id) => [id, true as const])
                  )
                }
              }
            }
          }
        }
        return state
      },
      name: 'satsigner-nostr',
      partialize: (state) => ({
        lastDataExchangeEOSE: state.lastDataExchangeEOSE,
        lastProtocolEOSE: state.lastProtocolEOSE,
        members: state.members,
        processedEvents: state.processedEvents,
        processedMessageIds: state.processedMessageIds,
        profiles: state.profiles,
        trustedDevices: state.trustedDevices
        // Excluded: syncStatus (runtime), activeSubscriptions (Set),
        // syncingAccounts (runtime), transactionToShare (runtime)
      }),
      storage: createJSONStorage(() => mmkvStorage),
      version: 1
    }
  )
)

export { useNostrStore }
export type { NostrProfile, NostrSyncStatus, SyncStatus }
