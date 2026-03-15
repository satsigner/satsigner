import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { type NostrAPI } from '@/api/nostr'
import { MAX_PROCESSED_ITEMS } from '@/constants/nostr'
import mmkvStorage from '@/storage/mmkv'
import { gray } from '@/styles/colors'
import { generateColorFromNpub } from '@/utils/nostr'
import { type TransactionData } from '@/utils/psbt'

type Member = {
  npub: string
  color: string
}

type NostrProfile = {
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
  status: 'idle',
  messagesReceived: 0,
  messagesProcessed: 0
}

// Prune oldest entries from a ProcessedIdsMap when it exceeds the limit
// JavaScript objects maintain insertion order for string keys, so Object.keys() returns them in order
function pruneProcessedIds(
  ids: ProcessedIdsMap,
  maxSize: number
): ProcessedIdsMap {
  const keys = Object.keys(ids)
  if (keys.length <= maxSize) return ids

  // Keep only the most recent entries (last maxSize keys)
  const keysToKeep = keys.slice(-maxSize)
  const pruned: ProcessedIdsMap = {}
  for (const key of keysToKeep) {
    pruned[key] = true
  }
  return pruned
}

type NostrState = {
  members: {
    [accountId: string]: Member[]
  }
  profiles: {
    [npub: string]: NostrProfile
  }
  processedMessageIds: {
    [accountId: string]: ProcessedIdsMap
  }
  processedEvents: {
    [accountId: string]: ProcessedIdsMap
  }
  lastProtocolEOSE: {
    [accountId: string]: number
  }
  lastDataExchangeEOSE: {
    [accountId: string]: number
  }
  trustedDevices: {
    [accountId: string]: string[]
  }
  syncStatus: {
    [accountId: string]: NostrSyncStatus
  }
  activeSubscriptions: Set<NostrAPI>
  syncingAccounts: {
    [accountId: string]: boolean
  }
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

type Message = {
  id: string
  author: string
  created_at: number
  description: string
  event: string
  label: number
  content: {
    description: string
    created_at: number
    pubkey?: string
  }
}

const useNostrStore = create<NostrState & NostrAction>()(
  persist(
    (set, get) => ({
      members: {},
      profiles: {},
      processedMessageIds: {},
      processedEvents: {},
      lastProtocolEOSE: {},
      lastDataExchangeEOSE: {},
      trustedDevices: {},
      syncStatus: {},
      transactionToShare: null,
      activeSubscriptions: new Set<NostrAPI>(),
      syncingAccounts: {},
      setProfile: (npub, profile) => {
        set((state) => ({
          profiles: {
            ...state.profiles,
            [npub]: { ...state.profiles[npub], ...profile }
          }
        }))
      },
      getProfile: (npub) => {
        return get().profiles[npub]
      },
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
                ? { npub: member, color: gray[500] }
                : member
            )

            // Double-check in case another call added this member
            const existingNpubs = new Set(normalizedMembers.map((m) => m.npub))
            if (!existingNpubs.has(npub)) {
              normalizedMembers.push({ npub, color })
            }

            return {
              members: {
                ...state.members,
                [accountId]: normalizedMembers
              }
            }
          })
        } catch (_error) {
          set((state) => {
            const existingMembers = state.members[accountId] || []
            const normalizedMembers = existingMembers.map((member) =>
              typeof member === 'string'
                ? { npub: member, color: gray[500] }
                : member
            )

            const existingNpubs = new Set(normalizedMembers.map((m) => m.npub))
            if (!existingNpubs.has(npub)) {
              normalizedMembers.push({ npub, color: gray[500] })
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
      getMembers: (accountId) => {
        return get().members[accountId] || []
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
          syncingAccounts: {},
          syncStatus: {},
          transactionToShare: null,
          trustedDevices: {}
        })
      },
      clearNostrState: (accountId) => {
        set((state) => ({
          members: {
            ...state.members,
            [accountId]: []
          },
          processedMessageIds: {
            ...state.processedMessageIds,
            [accountId]: {}
          },
          processedEvents: {
            ...state.processedEvents,
            [accountId]: {}
          },
          lastProtocolEOSE: {
            ...state.lastProtocolEOSE,
            [accountId]: 0
          },
          lastDataExchangeEOSE: {
            ...state.lastDataExchangeEOSE,
            [accountId]: 0
          },
          trustedDevices: {
            ...state.trustedDevices,
            [accountId]: []
          },
          syncStatus: {
            ...state.syncStatus,
            [accountId]: DEFAULT_SYNC_STATUS
          }
        }))
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
      getProcessedMessageIds: (accountId) => {
        const idsMap = get().processedMessageIds[accountId] || {}
        return Object.keys(idsMap)
      },
      clearProcessedMessageIds: (accountId) => {
        set((state) => ({
          processedMessageIds: {
            ...state.processedMessageIds,
            [accountId]: {}
          }
        }))
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
      getProcessedEvents: (accountId) => {
        const eventsMap = get().processedEvents[accountId] || {}
        return Object.keys(eventsMap)
      },
      clearProcessedEvents: (accountId) => {
        set((state) => ({
          processedEvents: {
            ...state.processedEvents,
            [accountId]: {}
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
      setLastDataExchangeEOSE: (accountId, timestamp) => {
        set((state) => ({
          lastDataExchangeEOSE: {
            ...state.lastDataExchangeEOSE,
            [accountId]: timestamp
          }
        }))
      },
      getLastProtocolEOSE: (accountId) => {
        return get().lastProtocolEOSE[accountId]
      },
      getLastDataExchangeEOSE: (accountId) => {
        return get().lastDataExchangeEOSE[accountId]
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
      getTrustedDevices: (accountId) => {
        return get().trustedDevices[accountId] || []
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
      getSyncStatus: (accountId) => {
        return get().syncStatus[accountId] || DEFAULT_SYNC_STATUS
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
      addSubscription: (subscription: NostrAPI) => {
        set((state) => {
          const newSubscriptions = new Set(state.activeSubscriptions)
          newSubscriptions.add(subscription)
          return { activeSubscriptions: newSubscriptions }
        })
      },
      clearSubscriptions: () => {
        set({ activeSubscriptions: new Set() })
      },
      getActiveSubscriptions: () => {
        return get().activeSubscriptions
      },
      setSyncing: (accountId, isSyncing) => {
        set((state) => ({
          syncingAccounts: {
            ...state.syncingAccounts,
            [accountId]: isSyncing
          }
        }))
      },
      isSyncing: (accountId) => {
        return get().syncingAccounts[accountId] || false
      },
      setTransactionToShare: (data) => set({ transactionToShare: data })
    }),
    {
      name: 'satsigner-nostr',
      storage: createJSONStorage(() => mmkvStorage),
      version: 1,
      partialize: (state) => ({
        members: state.members,
        profiles: state.profiles,
        processedMessageIds: state.processedMessageIds,
        processedEvents: state.processedEvents,
        lastProtocolEOSE: state.lastProtocolEOSE,
        lastDataExchangeEOSE: state.lastDataExchangeEOSE,
        trustedDevices: state.trustedDevices
        // Excluded: syncStatus (runtime), activeSubscriptions (Set),
        // syncingAccounts (runtime), transactionToShare (runtime)
      }),
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
      }
    }
  )
)

export { useNostrStore }
export type { Message, NostrProfile, NostrSyncStatus, SyncStatus }
