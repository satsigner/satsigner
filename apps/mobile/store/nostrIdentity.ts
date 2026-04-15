import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { NOSTR_RELAYS } from '@/constants/nostr'
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
  setRelays: (relays: string[]) => void
  addRelay: (url: string) => void
  removeRelay: (url: string) => void
  clearAll: () => void
}

const DEFAULT_RELAYS = NOSTR_RELAYS.slice(0, 4).map((r) => r.url)

const useNostrIdentityStore = create<
  NostrIdentityState & NostrIdentityActions
>()(
  persist(
    (set, get) => ({
      identities: [],
      activeIdentityNpub: null,
      relays: DEFAULT_RELAYS,

      addIdentity: (identity) => {
        set((state) => {
          if (state.identities.some((i) => i.npub === identity.npub)) {
            return state
          }
          return { identities: [...state.identities, identity] }
        })
      },

      removeIdentity: (npub) => {
        set((state) => ({
          identities: state.identities.filter((i) => i.npub !== npub),
          activeIdentityNpub:
            state.activeIdentityNpub === npub
              ? null
              : state.activeIdentityNpub
        }))
      },

      updateIdentity: (npub, updates) => {
        set((state) => ({
          identities: state.identities.map((i) =>
            i.npub === npub ? { ...i, ...updates } : i
          )
        }))
      },

      setActiveIdentity: (npub) => {
        set({ activeIdentityNpub: npub })
      },

      getActiveIdentity: () => {
        const { identities, activeIdentityNpub } = get()
        return identities.find((i) => i.npub === activeIdentityNpub)
      },

      setRelays: (relays) => {
        set({ relays })
      },

      addRelay: (url) => {
        set((state) => {
          if (state.relays.includes(url)) return state
          return { relays: [...state.relays, url] }
        })
      },

      removeRelay: (url) => {
        set((state) => ({
          relays: state.relays.filter((r) => r !== url)
        }))
      },

      clearAll: () => {
        set({
          identities: [],
          activeIdentityNpub: null,
          relays: DEFAULT_RELAYS
        })
      }
    }),
    {
      name: 'satsigner-nostr-identity',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        identities: state.identities.map((i) => ({
          ...i,
          nsec: i.nsec,
          mnemonic: i.mnemonic
        })),
        activeIdentityNpub: state.activeIdentityNpub,
        relays: state.relays
      })
    }
  )
)

export { useNostrIdentityStore }
