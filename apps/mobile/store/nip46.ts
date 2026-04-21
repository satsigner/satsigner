import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { NIP46_DEFAULT_PERMISSIONS } from '@/constants/nip46'
import mmkvStorage from '@/storage/mmkv'
import type {
  Nip46Method,
  Nip46PermissionPolicy,
  Nip46Request,
  Nip46Session
} from '@/types/models/Nip46'

type Nip46State = {
  pendingRequests: Nip46Request[]
  sessions: Nip46Session[]
}

type Nip46Actions = {
  addPendingRequest: (request: Nip46Request) => void
  addSession: (session: Nip46Session) => void
  clearSessionsForIdentity: (npub: string) => void
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

      addSession: (session) => {
        set((state) => {
          const exists = state.sessions.some(
            (s) =>
              s.clientPubkey === session.clientPubkey &&
              s.signerNpub === session.signerNpub
          )
          if (exists) {
            return {
              sessions: state.sessions.map((s) =>
                s.clientPubkey === session.clientPubkey &&
                s.signerNpub === session.signerNpub
                  ? {
                      ...s,
                      lastActiveAt: Date.now(),
                      relays: session.relays,
                      secret: session.secret
                    }
                  : s
              )
            }
          }
          return { sessions: [...state.sessions, session] }
        })
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
      partialize: (state) => ({
        sessions: state.sessions
      }),
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { NIP46_DEFAULT_PERMISSIONS, useNip46Store }
