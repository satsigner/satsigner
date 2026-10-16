import * as bitcoinjs from 'bitcoinjs-lib'
import {
  __resetPayjoinMock,
  __setMailboxProposal,
  createReceiverSession
} from 'react-native-payjoin'

import {
  clearReceiverSessionsForAccount,
  createReceivePayjoinSession,
  finalizeReceiverPayjoin,
  type FetchLike,
  pollBip77Send,
  startBip77Send
} from '@/api/payjoin'
import * as payjoinNative from '@/api/payjoinNative'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import {
  type PayjoinDeps,
  type PayjoinSession,
  type PayjoinSessionStore,
  type PayjoinWalletCallbacks
} from '@/types/payjoin'
import { parsePayjoinUri } from '@/utils/payjoinUri'

const TTL_MS = 120_000
const RECEIVE_ADDRESS = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
const CANDIDATE_TXID = 'bb'.repeat(32)
const SEEN_OUTPOINT = `${'cc'.repeat(32)}:3`

const PAYMENT_SCRIPT = Buffer.from(`0014${'22'.repeat(20)}`, 'hex')

function buildPsbt(inputs: { txid: string; vout: number }[]) {
  const psbt = new bitcoinjs.Psbt({ network: bitcoinjs.networks.testnet })
  for (const input of inputs) {
    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      witnessUtxo: {
        script: Buffer.from(`0014${'11'.repeat(20)}`, 'hex'),
        value: 100_000
      }
    })
  }
  psbt.addOutput({ script: PAYMENT_SCRIPT, value: 50_000 })
  return psbt.toBase64()
}

const ORIGINAL_PSBT = buildPsbt([{ txid: 'aa'.repeat(32), vout: 0 }])
const PROPOSAL_PSBT = buildPsbt([
  { txid: 'aa'.repeat(32), vout: 0 },
  { txid: CANDIDATE_TXID, vout: 1 }
])

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
    __resetPayjoinMock()
    usePayjoinSessionsStore.getState().clearAll()
  })

  afterEach(() => {
    jest.restoreAllMocks()
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

    const [contributeCall] = contribute.mock.calls
    const checks = contributeCall?.[3]
    expect(finalized.status).toBe('completed')
    expect(checks?.isOutpointSeen(SEEN_OUTPOINT)).toBe(true)
    expect(deps.sessions.hasSeenInput(`${CANDIDATE_TXID}:1`)).toBe(true)
    expect(usePayjoinSessionsStore.getState().seenInputs).toHaveLength(0)
  })

  it('tracks a BIP77 send in the injected store only', async () => {
    const deps = createDeps()
    const handle = await createReceiverSession({
      address: RECEIVE_ADDRESS,
      directoryUrl: 'https://payjo.in',
      expireSeconds: 600,
      ohttpRelayUrl: 'https://pj.bobspacebkk.com',
      receiveScriptHex: '0014751e76e8199196d454941c45d1b3a323f1433bd6'
    })
    const sendParams = {
      callbacks,
      disableOutputSubstitution: false,
      fetchImpl: noopFetch,
      outputScriptsHex: [PAYMENT_SCRIPT.toString('hex')],
      paymentAmountSats: 50_000
    }

    const started = await startBip77Send({
      ...sendParams,
      accountId: 'acct-send',
      deps,
      originalPsbtBase64: ORIGINAL_PSBT,
      payjoinUri: handle.pjUri,
      quickPollMs: 0
    })
    if (started.kind !== 'waiting') {
      throw new Error(`expected waiting, got ${started.kind}`)
    }
    expect(deps.sessions.getSession(started.session.id)?.role).toBe('sender')

    const mailboxId = parsePayjoinUri(handle.pjUri)
      .params?.pj.split('/')
      .pop()
      ?.split('#')[0]
    __setMailboxProposal(mailboxId ?? '', PROPOSAL_PSBT)
    const polled = await pollBip77Send({
      ...sendParams,
      deps,
      session: started.session,
      timeoutMs: 2000
    })

    expect(polled.kind).toBe('proposal')
    expect(deps.sessions.getSession(started.session.id)?.status).toBe(
      'completed'
    )
    expect(usePayjoinSessionsStore.getState().sessions).toHaveLength(0)
  })

  it('contributes an input the injected store has not seen', async () => {
    const deps = createDeps()
    deps.sessions.markInputSeen(`${CANDIDATE_TXID}:1`)
    const contribute = jest.spyOn(
      payjoinNative,
      'receiverContributeAndFinalize'
    )
    const session = await createReceivePayjoinSession({
      accountId: 'acct-pick',
      address: RECEIVE_ADDRESS,
      deps,
      network: 'signet'
    })
    const unseen = {
      scriptHex: `0014${'55'.repeat(20)}`,
      txid: 'dd'.repeat(32),
      value: 90_000,
      vout: 2
    }

    await finalizeReceiverPayjoin({
      callbacks: {
        ...callbacks,
        listCandidateOutpoints: () => [
          ...callbacks.listCandidateOutpoints(),
          unseen
        ]
      },
      deps,
      fetchImpl: noopFetch,
      session: {
        ...session,
        originalPsbtBase64: ORIGINAL_PSBT,
        status: 'proposal_received'
      }
    })

    const [contributeCall] = contribute.mock.calls
    expect(contributeCall?.[1]).toStrictEqual(unseen)
    expect(deps.sessions.hasSeenInput(`${unseen.txid}:${unseen.vout}`)).toBe(
      true
    )
  })
})
