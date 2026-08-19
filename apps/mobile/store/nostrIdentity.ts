import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { clearNdkRegistry } from '@/api/nostr'
import mmkvStorage from '@/storage/mmkv'
import { type NostrIdentity } from '@/types/models/Nostr'
import {
  deleteNostrIdentitySecretSafe,
  persistIdentitySecretsSafe
} from '@/utils/nostrSecrets'

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
            // New identities connect by default: adding one is explicit
            // intent to use nostr. The landing-page toggle disconnects.
            relayConnected: identity.relayConnected ?? true
          }
          return { identities: [...state.identities, next] }
        })
        void persistIdentitySecretsSafe(identity)
      },
      addRelay: (url) => {
        set((state) => {
          if (state.relays.includes(url)) {
            return state
          }
          return { relays: [...state.relays, url] }
        })
      },

      clearAll: () => {
        const { identities } = get()
        for (const identity of identities) {
          void deleteNostrIdentitySecretSafe(identity.npub)
        }
        clearNdkRegistry()
        set({
          activeIdentityNpub: null,
          identities: [],
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
        void deleteNostrIdentitySecretSafe(npub)
        set((state) => ({
          activeIdentityNpub:
            state.activeIdentityNpub === npub ? null : state.activeIdentityNpub,
          identities: state.identities.filter((i) => i.npub !== npub)
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
        const updated = get().identities.find((i) => i.npub === npub)
        if (
          updated &&
          (updates.nsec !== undefined || updates.mnemonic !== undefined)
        ) {
          void persistIdentitySecretsSafe(updated)
        }
      }
    }),
    {
      name: 'satsigner-nostr-identity',
      partialize: (state) => ({
        activeIdentityNpub: state.activeIdentityNpub,
        // Never persist nsec/mnemonic to MMKV — secrets live in SecureStore.
        identities: state.identities.map((identity) => {
          const { mnemonic: _mnemonic, nsec: _nsec, ...safe } = identity
          return safe
        }),
        relays: state.relays
      }),
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useNostrIdentityStore }
