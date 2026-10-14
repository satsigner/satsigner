import {
  clearReceiverSessionsForAccount,
  createReceivePayjoinSession
} from '@/api/payjoin'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import {
  type PayjoinDeps,
  type PayjoinSession,
  type PayjoinSessionStore
} from '@/types/payjoin'

const TTL_MS = 120_000

function createMemorySessionStore(): PayjoinSessionStore {
  const sessions = new Map<string, PayjoinSession>()
  const seen = new Set<string>()
  return {
    getSession: (id) => sessions.get(id),
    getSessions: () => [...sessions.values()],
    hasSeenInput: (outpoint) => seen.has(outpoint),
    markInputSeen: (outpoint) => {
      seen.add(outpoint)
    },
    removeSession: (id) => {
      sessions.delete(id)
    },
    updateSessionStatus: (id, status, patch) => {
      const session = sessions.get(id)
      if (session) {
        sessions.set(id, { ...session, ...patch, status })
      }
    },
    upsertSession: (session) => {
      sessions.set(session.id, session)
    }
  }
}

function createDeps(): PayjoinDeps {
  return {
    sessions: createMemorySessionStore(),
    settings: {
      directoryUrl: 'https://payjo.in',
      hasCustomDirectory: false,
      sessionTtlMs: TTL_MS
    }
  }
}

describe('payjoin injected dependencies', () => {
  beforeEach(() => {
    usePayjoinSessionsStore.getState().clearAll()
  })

  it('persists receiver sessions in the injected store only', async () => {
    const deps = createDeps()
    const session = await createReceivePayjoinSession({
      accountId: 'acct-deps',
      address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      deps,
      network: 'signet'
    })

    expect(deps.sessions.getSession(session.id)?.id).toBe(session.id)
    expect(usePayjoinSessionsStore.getState().sessions).toHaveLength(0)
  })

  it('uses the injected session TTL', async () => {
    const deps = createDeps()
    const session = await createReceivePayjoinSession({
      accountId: 'acct-ttl',
      address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      deps,
      network: 'signet'
    })

    expect(session.expiresAt - session.createdAt).toBe(TTL_MS)
  })

  it('clears receiver sessions from the injected store', async () => {
    const deps = createDeps()
    await createReceivePayjoinSession({
      accountId: 'acct-clear',
      address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      deps,
      network: 'signet'
    })

    clearReceiverSessionsForAccount('acct-clear', deps.sessions)

    expect(deps.sessions.getSessions()).toHaveLength(0)
  })
})
