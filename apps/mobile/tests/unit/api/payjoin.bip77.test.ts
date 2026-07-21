import * as bitcoinjs from 'bitcoinjs-lib'
import {
  __resetPayjoinMock,
  __setMailboxProposal,
  createReceiverSession
} from 'react-native-payjoin'

import {
  createReceivePayjoinSession,
  finalizeReceiverPayjoin,
  pollReceiverSession,
  processDirectoryBridgedBip78Proposal,
  sendPayjoin,
  type FetchLike
} from '@/api/payjoin'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import { type PayjoinWalletCallbacks } from '@/types/payjoin'
import { getShuffledOhttpRelays } from '@/utils/payjoinRelays'
import { parsePayjoinUri } from '@/utils/payjoinUri'

function buildPsbt(params: {
  inputs: { txid: string; vout: number }[]
  outputs: { script: Buffer; value: number }[]
}): bitcoinjs.Psbt {
  const psbt = new bitcoinjs.Psbt({ network: bitcoinjs.networks.testnet })
  for (const input of params.inputs) {
    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      sequence: 0xfffffffd,
      witnessUtxo: {
        script: Buffer.from('0014' + '11'.repeat(20), 'hex'),
        value: 100_000
      }
    })
  }
  for (const output of params.outputs) {
    psbt.addOutput({ script: output.script, value: output.value })
  }
  return psbt
}

const TXID_A = 'aa'.repeat(32)
const TXID_B = 'bb'.repeat(32)
const paymentScript = Buffer.from('0014' + '22'.repeat(20), 'hex')
const changeScript = Buffer.from('0014' + '33'.repeat(20), 'hex')

const original = buildPsbt({
  inputs: [{ txid: TXID_A, vout: 0 }],
  outputs: [
    { script: paymentScript, value: 50_000 },
    { script: changeScript, value: 49_000 }
  ]
})

const proposal = buildPsbt({
  inputs: [
    { txid: TXID_A, vout: 0 },
    { txid: TXID_B, vout: 1 }
  ],
  outputs: [
    { script: paymentScript, value: 50_000 },
    { script: changeScript, value: 148_500 }
  ]
})

const noopFetch: FetchLike = async () => ({
  body: '',
  bytes: new Uint8Array(),
  status: 200
})

const callbacks: PayjoinWalletCallbacks = {
  hasSeenInput: () => false,
  isScriptOwned: (scriptHex) => scriptHex === changeScript.toString('hex'),
  listCandidateOutpoints: () => [
    {
      scriptHex: Buffer.from('0014' + '44'.repeat(20), 'hex').toString('hex'),
      txid: TXID_B,
      value: 100_000,
      vout: 1
    }
  ],
  markInputSeen: () => undefined,
  signPsbt: (psbt) => psbt
}

describe('payjoin BIP77 + directory BIP78 bridge (phases 3–5)', () => {
  beforeEach(() => {
    __resetPayjoinMock()
    usePayjoinSessionsStore.getState().clearAll()
  })

  it('shuffles OHTTP relays', () => {
    const a = getShuffledOhttpRelays(['r1', 'r2', 'r3'])
    expect(a).toHaveLength(3)
    expect(new Set(a).size).toBe(3)
  })

  it('receiver session persists and resumes polling', async () => {
    const session = await createReceivePayjoinSession({
      accountId: 'a1',
      address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      amountSats: 50_000
    })

    expect(session.status).toBe('ready')
    expect(session.protocol).toBe('v2')

    const polled = await pollReceiverSession({
      callbacks,
      fetchImpl: noopFetch,
      session
    })
    expect(polled.session.status).toBe('waiting')
  })

  it('receiver finalizes after directory-bridged BIP78 original', async () => {
    const session = await createReceivePayjoinSession({
      accountId: 'a1',
      address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
    })

    const finalized = await processDirectoryBridgedBip78Proposal({
      callbacks,
      fetchImpl: noopFetch,
      originalPsbtBase64: original.toBase64(),
      session
    })

    expect(finalized.status).toBe('completed')
    expect(finalized.payjoinPsbtBase64).toBeTruthy()
    expect(usePayjoinSessionsStore.getState().hasSeenInput(`${TXID_B}:1`)).toBe(
      true
    )
  })

  it('rejects replay of seen inputs', async () => {
    const session = await createReceivePayjoinSession({
      accountId: 'a1',
      address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
    })
    usePayjoinSessionsStore.getState().markInputSeen(`${TXID_B}:1`)

    const withProposal = {
      ...session,
      originalPsbtBase64: original.toBase64(),
      status: 'proposal_received' as const
    }

    const finalized = await finalizeReceiverPayjoin({
      callbacks: {
        ...callbacks,
        listCandidateOutpoints: () => [
          {
            scriptHex: '0014' + '44'.repeat(20),
            txid: TXID_B,
            value: 100_000,
            vout: 1
          }
        ]
      },
      fetchImpl: noopFetch,
      session: withProposal
    })

    expect(finalized.status).toBe('error')
    expect(finalized.error).toContain('seen before')
  })

  it('bIP77 send completes when mailbox has proposal', async () => {
    const handle = await createReceiverSession({
      address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      directoryUrl: 'https://payjo.in',
      expireSeconds: 600,
      ohttpRelayUrl: 'https://pj.bobspacebkk.com'
    })

    const parsed = parsePayjoinUri(handle.pjUri)
    expect(parsed.isValid).toBe(true)
    const mailboxId = parsed.params!.pj.split('/').pop()!.split('#')[0]!
    __setMailboxProposal(mailboxId, proposal.toBase64())

    // Also put original so createSenderSession path works
    const result = await sendPayjoin({
      callbacks: {
        ...callbacks,
        signPsbt: (psbt) => `SIGNED:${psbt}`
      },
      fetchImpl: noopFetch,
      originalPsbtBase64: original.toBase64(),
      outputScriptsHex: [paymentScript.toString('hex')],
      payjoinUri: handle.pjUri,
      paymentAmountSats: 50_000,
      timeoutMs: 2000
    })

    expect(result.ok).toBe(true)
    if (result.ok && result.usedPayjoin) {
      expect(result.protocol).toBe('v2')
      expect(result.psbtBase64.startsWith('SIGNED:')).toBe(true)
    } else if (result.ok && !result.usedPayjoin) {
      // Mock may return pending then proposal depending on timing; accept fallback
      // only if mailbox wiring failed — fail loudly otherwise.
      throw new Error(`expected payjoin, got fallback: ${result.reason}`)
    }
  })

  it('times out BIP77 send to fallback when no proposal', async () => {
    const result = await sendPayjoin({
      callbacks,
      fetchImpl: noopFetch,
      originalPsbtBase64: original.toBase64(),
      outputScriptsHex: [paymentScript.toString('hex')],
      payjoinUri:
        'bitcoin:tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx?pjos=0&pj=https://payjo.in/empty#RK1-x',
      paymentAmountSats: 50_000,
      timeoutMs: 100
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.usedPayjoin).toBe(false)
    }
  })
})
