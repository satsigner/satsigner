import {
  clearReceiverSessionsForAccount,
  createReceivePayjoinSession,
  finalizeReceiverPayjoin,
  type FetchLike
} from '@/api/payjoin'
import * as payjoinNative from '@/api/payjoinNative'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import {
  type PayjoinDeps,
  type PayjoinSession,
  type PayjoinSessionStore,
  type PayjoinWalletCallbacks
} from '@/types/payjoin'

const TTL_MS = 120_000
const RECEIVE_ADDRESS = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
const CANDIDATE_TXID = 'bb'.repeat(32)
const SEEN_OUTPOINT = `${'cc'.repeat(32)}:3`

const noopFetch: FetchLike = () =>
  Promise.resolve({ body: '', bytes: new Uint8Array(), status: 200 })

const callbacks: PayjoinWalletCallbacks = {
  hasSeenInput: () => false,
  isScriptOwned: () => false,
  listCandidateOutpoints: () => [
    {
      scriptHex: `0014${'44'.repeat(20)}`,
      txid: CANDIDATE_TXID,
      value: 100_000,
      vout: 1
    }
  ],
  markInputSeen: () => undefined,
  signPsbt: (psbt) => psbt
}

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

  it('checks and marks seen inputs through the injected store', async () => {
    const deps = createDeps()
    deps.sessions.markInputSeen(SEEN_OUTPOINT)
    const contribute = jest.spyOn(
      payjoinNative,
      'receiverContributeAndFinalize'
    )
    const session = await createReceivePayjoinSession({
      accountId: 'acct-seen',
      address: RECEIVE_ADDRESS,
      deps,
      network: 'signet'
    })

    const finalized = await finalizeReceiverPayjoin({
      callbacks,
      deps,
      fetchImpl: noopFetch,
      session: {
        ...session,
        originalPsbtBase64: 'cHNidP8original',
        status: 'proposal_received'
      }
    })

    const checks = contribute.mock.calls[0][3]
    expect(finalized.status).toBe('completed')
    expect(checks?.isOutpointSeen(SEEN_OUTPOINT)).toBe(true)
    expect(deps.sessions.hasSeenInput(`${CANDIDATE_TXID}:1`)).toBe(true)
    expect(usePayjoinSessionsStore.getState().seenInputs).toHaveLength(0)
    contribute.mockRestore()
  })
})
