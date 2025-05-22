import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { nip19 } from 'nostr-tools'
import * as bitcoinjs from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'

import mmkvStorage from '@/storage/mmkv'
import { NostrAPI } from '@/api/nostr'

// Initialize ECC library
bitcoinjs.initEccLib(ecc)

type Member = {
  npub: string
  color: string
}

export type { Member }

type NostrState = {
  members: {
    [accountId: string]: Member[]
  }
  processedMessageIds: {
    [accountId: string]: string[]
  }
  processedEvents: {
    [accountId: string]: string[]
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
  activeSubscriptions: Set<NostrAPI>
}

export type { NostrState }

type NostrAction = {
  addMember: (accountId: string, npub: string) => void
  removeMember: (accountId: string, npub: string) => void
  getMembers: (accountId: string) => Member[]
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
  addSubscription: (subscription: NostrAPI) => void
  clearSubscriptions: () => void
  getActiveSubscriptions: () => Set<NostrAPI>
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

async function generateColorFromNpub(npub: string): Promise<string> {
  try {
    // Convert npub to pubkey
    const decoded = nip19.decode(npub)
    if (!decoded || decoded.type !== 'npub') {
      return '#404040' // Default color for invalid npub
    }
    const pubkey = npub

    // Generate color from hash - match Python's hashlib.sha256() output
    const hash = bitcoinjs.crypto.sha256(Buffer.from(pubkey)).toString('hex')
    const seed = BigInt('0x' + hash)
    const hue = Number(seed % BigInt(360)) // Map to a hue value between 0-359

    const saturation = 255 // High saturation for vividness
    const lightness = 180 // Dark mode value (180/255 * 100 ≈ 70%)

    // QColor's HSL to RGB conversion algorithm
    const h = hue / 60
    const s = saturation / 255
    const l = lightness / 255

    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs((h % 2) - 1))
    const m = l - c / 2

    let r, g, b
    if (h < 1) [r, g, b] = [c, x, 0]
    else if (h < 2) [r, g, b] = [x, c, 0]
    else if (h < 3) [r, g, b] = [0, c, x]
    else if (h < 4) [r, g, b] = [0, x, c]
    else if (h < 5) [r, g, b] = [x, 0, c]
    else [r, g, b] = [c, 0, x]

    const toHex = (n: number) => {
      const hex = Math.round((n + m) * 255).toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  } catch (error) {
    // Log error for debugging purposes
    // eslint-disable-next-line no-console
    console.error('Error generating color from npub:', error)
    return '#404040' // Default color on error
  }
}

const useNostrStore = create<NostrState & NostrAction>()(
  persist(
    (set, get) => ({
      members: {},
      processedMessageIds: {},
      processedEvents: {},
      lastProtocolEOSE: {},
      lastDataExchangeEOSE: {},
      trustedDevices: {},
      activeSubscriptions: new Set<NostrAPI>(),
      addMember: async (accountId, npub) => {
        try {
          const color = await generateColorFromNpub(npub)
          set((state) => {
            const existingMembers = state.members[accountId] || []
            const normalizedMembers = existingMembers.map((member) =>
              typeof member === 'string'
                ? { npub: member, color: '#404040' }
                : member
            )

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
                ? { npub: member, color: '#404040' }
                : member
            )

            const existingNpubs = new Set(normalizedMembers.map((m) => m.npub))
            if (!existingNpubs.has(npub)) {
              console.log('Adding member with default color:', npub)
              normalizedMembers.push({ npub, color: '#404040' })
            }

            const newState = {
              ...state,
              members: {
                ...state.members,
                [accountId]: normalizedMembers
              }
            }
            console.log(
              'New members state (with default color):',
              newState.members[accountId]
            )
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
      clearNostrState: (accountId) => {
        set((state) => ({
          members: {
            [accountId]: []
          },
          processedMessageIds: {
            [accountId]: []
          },
          processedEvents: {
            [accountId]: []
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
            [accountId]: []
          }
        }))
      },
      addProcessedMessageId: (accountId, messageId) => {
        set((state) => {
          const currentIds = state.processedMessageIds[accountId] || []
          if (!currentIds.includes(messageId)) {
            return {
              processedMessageIds: {
                ...state.processedMessageIds,
                [accountId]: [...currentIds, messageId]
              }
            }
          }
          return state
        })
      },
      getProcessedMessageIds: (accountId) => {
        return get().processedMessageIds[accountId] || []
      },
      clearProcessedMessageIds: (accountId) => {
        set((state) => ({
          processedMessageIds: {
            ...state.processedMessageIds,
            [accountId]: []
          }
        }))
      },
      addProcessedEvent: (accountId, eventId) => {
        set((state) => {
          const currentEvents = state.processedEvents[accountId] || []
          if (!currentEvents.includes(eventId)) {
            return {
              processedEvents: {
                ...state.processedEvents,
                [accountId]: [...currentEvents, eventId]
              }
            }
          }
          return state
        })
      },
      getProcessedEvents: (accountId) => {
        return get().processedEvents[accountId] || []
      },
      clearProcessedEvents: (accountId) => {
        set((state) => ({
          processedEvents: {
            ...state.processedEvents,
            [accountId]: []
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
      }
    }),
    {
      name: 'satsigner-nostr',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useNostrStore, generateColorFromNpub }
export type { Message }
