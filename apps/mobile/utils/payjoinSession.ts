import { type PayjoinSession } from '@/types/payjoin'

type NewPayjoinSession = Omit<
  PayjoinSession,
  'id' | 'createdAt' | 'updatedAt' | 'expiresAt'
> & {
  ttlMs: number
}

function createSessionId() {
  return `pj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/** Stamps a new session with an id, timestamps and expiry `ttlMs` from now. */
function buildNewSession({ ttlMs, ...partial }: NewPayjoinSession) {
  const now = Date.now()
  return {
    ...partial,
    createdAt: now,
    expiresAt: now + ttlMs,
    id: createSessionId(),
    updatedAt: now
  } satisfies PayjoinSession
}

export { buildNewSession }
