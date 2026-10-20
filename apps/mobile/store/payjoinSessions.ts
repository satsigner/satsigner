import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import { getPayjoinSettings } from '@/store/settings'
import {
  type PayjoinDeps,
  type PayjoinSession,
  type PayjoinSessionStore
} from '@/types/payjoin'
import { isPayjoinTerminal } from '@/utils/payjoinSessionStatus'

// Cap `seenInputs` growth: once it exceeds SEEN_INPUTS_MAX, trim back down
// to the most recent SEEN_INPUTS_TRIM_TO entries.
const SEEN_INPUTS_MAX = 2000
const SEEN_INPUTS_TRIM_TO = 1500

type PayjoinSessionsState = {
  sessions: PayjoinSession[]
  /** Outpoints seen in prior payjoin proposals (replay protection). */
  seenInputs: string[]
}

type PayjoinSessionsAction = Omit<PayjoinSessionStore, 'getSessions'> & {
  getActiveReceiverSession: (accountId: string) => PayjoinSession | undefined
  getActiveSenderSession: (accountId: string) => PayjoinSession | undefined
  clearExpiredSessions: (now?: number) => void
  clearAll: () => void
}

/** Drop PSBT / native blobs once a session is terminal — keeps MMKV + heap lean. */
function stripHeavySessionFields(session: PayjoinSession): PayjoinSession {
  if (!isPayjoinTerminal(session.status)) {
    return session
  }
  if (
    session.nativeState === undefined &&
    session.originalPsbtBase64 === undefined &&
    session.proposalPsbtBase64 === undefined &&
    session.payjoinPsbtBase64 === undefined
  ) {
    return session
  }
  return {
    ...session,
    nativeState: undefined,
    originalPsbtBase64: undefined,
    payjoinPsbtBase64: undefined,
    proposalPsbtBase64: undefined
  }
}

const usePayjoinSessionsStore = create<
  PayjoinSessionsState & PayjoinSessionsAction
>()(
  persist(
    (set, get) => ({
      clearAll: () => set({ seenInputs: [], sessions: [] }),
      clearExpiredSessions: (now = Date.now()) => {
        set((state) => {
          const sessions = state.sessions
            .filter((session) => session.expiresAt > now)
            .map(stripHeavySessionFields)
          if (sessions.length === state.sessions.length) {
            const unchanged = sessions.every(
              (session, index) => session === state.sessions[index]
            )
            if (unchanged) {
              return state
            }
          }
          return { sessions }
        })
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
        return candidates.find((s) => !!s.nativeState) ?? candidates[0]
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
          if (state.seenInputs.includes(outpoint)) {
            return state
          }
          const seenInputs = [...state.seenInputs, outpoint]
          // Cap growth
          if (seenInputs.length > SEEN_INPUTS_MAX) {
            return { seenInputs: seenInputs.slice(-SEEN_INPUTS_TRIM_TO) }
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
          sessions: state.sessions.map((session) => {
            if (session.id !== id) {
              return session
            }
            return stripHeavySessionFields({
              ...session,
              ...patch,
              status,
              updatedAt: Date.now()
            })
          })
        }))
      },

      upsertSession: (session) => {
        const nextSession = stripHeavySessionFields(session)
        set((state) => {
          const index = state.sessions.findIndex((s) => s.id === nextSession.id)
          if (index === -1) {
            return { sessions: [...state.sessions, nextSession] }
          }
          const next = [...state.sessions]
          next[index] = nextSession
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

const payjoinSessionStore: PayjoinSessionStore = {
  getSession: (id) => usePayjoinSessionsStore.getState().getSession(id),
  getSessions: () => usePayjoinSessionsStore.getState().sessions,
  hasSeenInput: (outpoint) =>
    usePayjoinSessionsStore.getState().hasSeenInput(outpoint),
  markInputSeen: (outpoint) =>
    usePayjoinSessionsStore.getState().markInputSeen(outpoint),
  removeSession: (id) => usePayjoinSessionsStore.getState().removeSession(id),
  updateSessionStatus: (id, status, patch) =>
    usePayjoinSessionsStore.getState().updateSessionStatus(id, status, patch),
  upsertSession: (session) =>
    usePayjoinSessionsStore.getState().upsertSession(session)
}

/** Live session store and current settings, for passing into `@/api/payjoin`. */
function getPayjoinDeps(): PayjoinDeps {
  return {
    sessions: payjoinSessionStore,
    settings: getPayjoinSettings()
  }
}

export { getPayjoinDeps, usePayjoinSessionsStore }
