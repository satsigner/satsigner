import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { PAYJOIN_SESSION_TTL_MS } from '@/constants/payjoin'
import mmkvStorage from '@/storage/mmkv'
import { type PayjoinSession, type PayjoinSessionStatus } from '@/types/payjoin'

type PayjoinSessionsState = {
  sessions: PayjoinSession[]
  /** Outpoints seen in prior payjoin proposals (replay protection). */
  seenInputs: string[]
}

type PayjoinSessionsAction = {
  upsertSession: (session: PayjoinSession) => void
  updateSessionStatus: (
    id: string,
    status: PayjoinSessionStatus,
    patch?: Partial<PayjoinSession>
  ) => void
  getSession: (id: string) => PayjoinSession | undefined
  getActiveReceiverSession: (accountId: string) => PayjoinSession | undefined
  getActiveSenderSession: (accountId: string) => PayjoinSession | undefined
  removeSession: (id: string) => void
  clearExpiredSessions: (now?: number) => void
  markInputSeen: (outpoint: string) => void
  hasSeenInput: (outpoint: string) => boolean
  clearAll: () => void
}

function createSessionId(): string {
  return `pj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

const usePayjoinSessionsStore = create<
  PayjoinSessionsState & PayjoinSessionsAction
>()(
  persist(
    (set, get) => ({
      clearAll: () => set({ seenInputs: [], sessions: [] }),
      clearExpiredSessions: (now = Date.now()) => {
        set((state) => ({
          sessions: state.sessions.filter(
            (s) =>
              s.expiresAt > now ||
              s.status === 'completed' ||
              s.status === 'fallback'
          )
        }))
      },

      getActiveReceiverSession: (accountId) => {
        const now = Date.now()
        const candidates = get().sessions.filter(
          (s) =>
            s.accountId === accountId &&
            s.role === 'receiver' &&
            s.expiresAt > now &&
            (s.status === 'ready' ||
              s.status === 'waiting' ||
              s.status === 'negotiating' ||
              s.status === 'initializing' ||
              s.status === 'proposal_received' ||
              s.status === 'finalizing')
        )
        // Prefer a session that still has native state for resume.
        return (
          candidates.find((s) => !!s.nativeState) ?? candidates[0]
        )
      },

      getActiveSenderSession: (accountId) => {
        const now = Date.now()
        return get().sessions.find(
          (s) =>
            s.accountId === accountId &&
            s.role === 'sender' &&
            s.expiresAt > now &&
            !!s.nativeState &&
            (s.status === 'waiting' ||
              s.status === 'negotiating' ||
              s.status === 'ready')
        )
      },

      getSession: (id) => get().sessions.find((s) => s.id === id),

      hasSeenInput: (outpoint) => get().seenInputs.includes(outpoint),

      markInputSeen: (outpoint) => {
        set((state) => {
          if (state.seenInputs.includes(outpoint)) {return state}
          const seenInputs = [...state.seenInputs, outpoint]
          // Cap growth
          if (seenInputs.length > 2000) {
            return { seenInputs: seenInputs.slice(-1500) }
          }
          return { seenInputs }
        })
      },

      removeSession: (id) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id)
        }))
      },

      seenInputs: [],

      sessions: [],

      updateSessionStatus: (id, status, patch) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === id
              ? {
                  ...session,
                  ...patch,
                  status,
                  updatedAt: Date.now()
                }
              : session
          )
        }))
      },

      upsertSession: (session) => {
        set((state) => {
          const index = state.sessions.findIndex((s) => s.id === session.id)
          if (index === -1) {
            return { sessions: [...state.sessions, session] }
          }
          const next = [...state.sessions]
          next[index] = session
          return { sessions: next }
        })
      }
    }),
    {
      name: 'payjoin-sessions-store',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

function buildNewSession(
  partial: Omit<
    PayjoinSession,
    'id' | 'createdAt' | 'updatedAt' | 'expiresAt'
  > & {
    ttlMs?: number
  }
): PayjoinSession {
  const now = Date.now()
  const ttl = partial.ttlMs ?? PAYJOIN_SESSION_TTL_MS
  return {
    ...partial,
    createdAt: now,
    expiresAt: now + ttl,
    id: createSessionId(),
    updatedAt: now
  }
}

export { buildNewSession, createSessionId, usePayjoinSessionsStore }
