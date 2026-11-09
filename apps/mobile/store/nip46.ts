import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import type {
  Nip46Method,
  Nip46PermissionPolicy,
  Nip46Request,
  Nip46Session
} from '@/types/models/Nostr'
import { toRestoredNip46Session } from '@/utils/nip46'

type Nip46State = {
  pendingRequests: Nip46Request[]
  sessions: Nip46Session[]
}

type Nip46Actions = {
  addPendingRequest: (request: Nip46Request) => void
  addSession: (session: Nip46Session) => Nip46Session
  clearAll: () => void
  clearSessionsForIdentity: (npub: string) => void
  disconnectRestoredSessions: () => void
  getSessionsForIdentity: (npub: string) => Nip46Session[]
  removePendingRequest: (requestId: string) => void
  removeSession: (sessionId: string) => void
  updatePermission: (
    sessionId: string,
    method: Nip46Method,
    policy: Nip46PermissionPolicy
  ) => void
  updateSession: (sessionId: string, updates: Partial<Nip46Session>) => void
}

const useNip46Store = create<Nip46State & Nip46Actions>()(
  persist(
    (set, get) => ({
      addPendingRequest: (request) => {
        set((state) => ({
          pendingRequests: [...state.pendingRequests, request]
        }))
      },

      // Pairing a known client again updates its session in place, so the
      // caller must run the session it gets back, not the one it passed in.
      addSession: (session) => {
        const existing = get().sessions.find(
          (s) =>
            s.clientPubkey === session.clientPubkey &&
            s.signerNpub === session.signerNpub
        )
        if (!existing) {
          set((state) => ({ sessions: [...state.sessions, session] }))
          return session
        }
        const updated: Nip46Session = {
          ...existing,
          lastActiveAt: Date.now(),
          relays: session.relays,
          secret: session.secret
        }
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === existing.id ? updated : s
          )
        }))
        return updated
      },

      clearAll: () => {
        set({ pendingRequests: [], sessions: [] })
      },

      clearSessionsForIdentity: (npub) => {
        set((state) => ({
          pendingRequests: state.pendingRequests.filter((r) => {
            const session = state.sessions.find((s) => s.id === r.sessionId)
            return session?.signerNpub !== npub
          }),
          sessions: state.sessions.filter((s) => s.signerNpub !== npub)
        }))
      },

      // No bunker survives a restart, so no stored session is still live.
      disconnectRestoredSessions: () => {
        set((state) => ({
          sessions: state.sessions.map(toRestoredNip46Session)
        }))
      },

      getSessionsForIdentity: (npub) =>
        get().sessions.filter((s) => s.signerNpub === npub),

      pendingRequests: [],

      removePendingRequest: (requestId) => {
        set((state) => ({
          pendingRequests: state.pendingRequests.filter(
            (r) => r.id !== requestId
          )
        }))
      },

      removeSession: (sessionId) => {
        set((state) => ({
          pendingRequests: state.pendingRequests.filter(
            (r) => r.sessionId !== sessionId
          ),
          sessions: state.sessions.filter((s) => s.id !== sessionId)
        }))
      },

      sessions: [],

      updatePermission: (sessionId, method, policy) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  permissions: { ...s.permissions, [method]: policy }
                }
              : s
          )
        }))
      },

      updateSession: (sessionId, updates) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, ...updates } : s
          )
        }))
      }
    }),
    {
      name: 'nip46-storage',
      onRehydrateStorage: () => (state) => {
        state?.disconnectRestoredSessions()
      },
      partialize: (state) => ({
        sessions: state.sessions
      }),
      storage: createJSONStorage(() => mmkvStorage),
      version: 0
    }
  )
)

export { useNip46Store }
