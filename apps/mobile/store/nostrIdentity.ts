import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import { type NostrIdentity } from '@/types/models/NostrIdentity'

type NostrIdentityState = {
  identities: NostrIdentity[]
  activeIdentityNpub: string | null
  relays: string[]
}

type NostrIdentityActions = {
  addIdentity: (identity: NostrIdentity) => void
  removeIdentity: (npub: string) => void
  updateIdentity: (npub: string, updates: Partial<NostrIdentity>) => void
  setActiveIdentity: (npub: string | null) => void
  getActiveIdentity: () => NostrIdentity | undefined
  setAllRelayConnected: (connected: boolean) => void
  setRelays: (relays: string[]) => void
  addRelay: (url: string) => void
  removeRelay: (url: string) => void
  clearAll: () => void
}

const DEFAULT_RELAYS: string[] = []

const useNostrIdentityStore = create<
  NostrIdentityState & NostrIdentityActions
>()(
  persist(
    (set, get) => ({
      activeIdentityNpub: null,
      addIdentity: (identity) => {
        set((state) => {
          if (state.identities.some((i) => i.npub === identity.npub)) {
            return state
          }
          const next: NostrIdentity = {
            ...identity,
            relayConnected: identity.relayConnected ?? false
          }
          return { identities: [...state.identities, next] }
        })
      },
      addRelay: (url) => {
        set((state) => {
          if (state.relays.includes(url)) return state
          return { relays: [...state.relays, url] }
        })
      },

      clearAll: () => {
        set({
          identities: [],
          activeIdentityNpub: null,
          relays: DEFAULT_RELAYS
        })
      },

      getActiveIdentity: () => {
        const { identities, activeIdentityNpub } = get()
        return identities.find((i) => i.npub === activeIdentityNpub)
      },

      identities: [],

      relays: DEFAULT_RELAYS,

      removeIdentity: (npub) => {
        set((state) => ({
          identities: state.identities.filter((i) => i.npub !== npub),
          activeIdentityNpub:
            state.activeIdentityNpub === npub ? null : state.activeIdentityNpub
        }))
      },

      removeRelay: (url) => {
        set((state) => ({
          relays: state.relays.filter((r) => r !== url)
        }))
      },

      setActiveIdentity: (npub) => {
        set({ activeIdentityNpub: npub })
      },

      setAllRelayConnected: (connected) => {
        set((state) => ({
          identities: state.identities.map((i) => ({
            ...i,
            relayConnected: connected
          }))
        }))
      },

      setRelays: (relays) => {
        set({ relays })
      },

      updateIdentity: (npub, updates) => {
        set((state) => ({
          identities: state.identities.map((i) =>
            i.npub === npub ? { ...i, ...updates } : i
          )
        }))
      }
    }),
    {
      name: 'satsigner-nostr-identity',
      partialize: (state) => ({
        identities: state.identities.map((i) => ({
          ...i,
          nsec: i.nsec,
          mnemonic: i.mnemonic
        })),
        activeIdentityNpub: state.activeIdentityNpub,
        relays: state.relays
      }),
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useNostrIdentityStore }
