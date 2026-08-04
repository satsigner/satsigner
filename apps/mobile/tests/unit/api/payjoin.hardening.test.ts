/* eslint-disable jest/no-conditional-expect, jest/max-expects -- soft assertions when payjoin relay/fallback varies */
import * as bitcoinjs from 'bitcoinjs-lib'
import { __resetPayjoinMock } from 'react-native-payjoin'

import {
  createReceivePayjoinSession,
  finalizeReceiverPayjoin,
  sendPayjoin,
  type FetchLike
} from '@/api/payjoin'
import * as payjoinNative from '@/api/payjoinNative'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import { type PayjoinWalletCallbacks } from '@/types/payjoin'
import { validatePayjoinProposal } from '@/utils/payjoinValidate'

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
        script: Buffer.from(`0014${'11'.repeat(20)}`, 'hex'),
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
const TXID_C = 'cc'.repeat(32)
const paymentScript = Buffer.from(`0014${'22'.repeat(20)}`, 'hex')
const changeScript = Buffer.from(`0014${'33'.repeat(20)}`, 'hex')

describe('payjoin hardening (phase 7)', () => {
  beforeEach(() => {
    __resetPayjoinMock()
    usePayjoinSessionsStore.getState().clearAll()
  })

  it('rejects adversarial proposal that drops sender inputs', () => {
    const original = buildPsbt({
      inputs: [{ txid: TXID_A, vout: 0 }],
      outputs: [{ script: paymentScript, value: 50_000 }]
    })
    const adversarial = buildPsbt({
      inputs: [{ txid: TXID_C, vout: 0 }],
      outputs: [{ script: paymentScript, value: 50_000 }]
    })

    const result = validatePayjoinProposal({
      disableOutputSubstitution: true,
      isScriptOwned: () => false,
      originalPsbtBase64: original.toBase64(),
      paymentAmountSats: 50_000,
      paymentScriptsHex: [paymentScript.toString('hex')],
      proposalPsbtBase64: adversarial.toBase64()
    })

    expect(result.ok).toBe(false)
  })

  it('rejects proposal that reduces receiver payment under pjos=0', () => {
    const original = buildPsbt({
      inputs: [{ txid: TXID_A, vout: 0 }],
      outputs: [
        { script: paymentScript, value: 50_000 },
        { script: changeScript, value: 49_000 }
      ]
    })
    const reduced = buildPsbt({
      inputs: [
        { txid: TXID_A, vout: 0 },
        { txid: TXID_B, vout: 1 }
      ],
      outputs: [
        { script: paymentScript, value: 10_000 },
        { script: changeScript, value: 188_500 }
      ]
    })

    const result = validatePayjoinProposal({
      disableOutputSubstitution: true,
      isScriptOwned: (scriptHex) => scriptHex === changeScript.toString('hex'),
      originalPsbtBase64: original.toBase64(),
      paymentAmountSats: 50_000,
      paymentScriptsHex: [paymentScript.toString('hex')],
      proposalPsbtBase64: reduced.toBase64()
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toMatch(/amount|substituted|outputs/i)
    }
  })

  it('marks contributed inputs as seen (replay protection store)', async () => {
    const session = await createReceivePayjoinSession({
      accountId: 'a1',
      address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
    })
    const original = buildPsbt({
      inputs: [{ txid: TXID_A, vout: 0 }],
      outputs: [{ script: paymentScript, value: 50_000 }]
    })

    const callbacks: PayjoinWalletCallbacks = {
      hasSeenInput: (o) => usePayjoinSessionsStore.getState().hasSeenInput(o),
      isScriptOwned: () => false,
      listCandidateOutpoints: () => [
        {
          scriptHex: `0014${'44'.repeat(20)}`,
          txid: TXID_B,
          value: 100_000,
          vout: 1
        }
      ],
      markInputSeen: (o) => usePayjoinSessionsStore.getState().markInputSeen(o),
      signPsbt: (psbt) => psbt
    }

    const finalized = await finalizeReceiverPayjoin({
      callbacks,
      fetchImpl: () =>
        Promise.resolve({
          body: '',
          bytes: new Uint8Array(),
          status: 200
        }),
      session: {
        ...session,
        originalPsbtBase64: original.toBase64(),
        status: 'proposal_received'
      }
    })

    expect(finalized.status).toBe('completed')
    expect(usePayjoinSessionsStore.getState().hasSeenInput(`${TXID_B}:1`)).toBe(
      true
    )
  })

  it('passes working ownership and replay checks to the receiver contribute step', async () => {
    const nativeSpy = jest.spyOn(payjoinNative, 'receiverContributeAndFinalize')
    const session = await createReceivePayjoinSession({
      accountId: 'a1',
      address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
    })
    const original = buildPsbt({
      inputs: [{ txid: TXID_A, vout: 0 }],
      outputs: [{ script: paymentScript, value: 50_000 }]
    })
    // The receiver owns its candidate UTXO (TXID_B:1); the sender's original
    // input (TXID_A:0) has been seen before.
    const ownedOutpoint = `${TXID_B}:1`
    const seenOutpoint = `${TXID_A}:0`

    const callbacks: PayjoinWalletCallbacks = {
      hasSeenInput: (o) => o === seenOutpoint,
      isScriptOwned: () => false,
      listCandidateOutpoints: () => [
        {
          scriptHex: `0014${'44'.repeat(20)}`,
          txid: TXID_B,
          value: 100_000,
          vout: 1
        }
      ],
      markInputSeen: () => undefined,
      signPsbt: (psbt) => psbt
    }

    await finalizeReceiverPayjoin({
      callbacks,
      fetchImpl: () =>
        Promise.resolve({ body: '', bytes: new Uint8Array(), status: 200 }),
      session: {
        ...session,
        originalPsbtBase64: original.toBase64(),
        status: 'proposal_received'
      }
    })

    const contributeCall = nativeSpy.mock.calls.find((call) => call[2] === '')
    expect(contributeCall).toBeDefined()
    const checks = contributeCall?.[3]
    expect(checks).toBeDefined()
    expect(checks?.isOutpointOwned(ownedOutpoint)).toBe(true)
    expect(checks?.isOutpointOwned(`${TXID_C}:0`)).toBe(false)
    expect(checks?.isOutpointSeen(seenOutpoint)).toBe(true)
    expect(checks?.isOutpointSeen(ownedOutpoint)).toBe(false)
    nativeSpy.mockRestore()
  })

  it('does not mark receiver complete when proposal POST fails', async () => {
    const session = await createReceivePayjoinSession({
      accountId: 'a1',
      address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
    })
    const original = buildPsbt({
      inputs: [{ txid: TXID_A, vout: 0 }],
      outputs: [{ script: paymentScript, value: 50_000 }]
    })

    await expect(
      finalizeReceiverPayjoin({
        callbacks: {
          hasSeenInput: () => false,
          isScriptOwned: () => false,
          listCandidateOutpoints: () => [
            {
              scriptHex: `0014${'44'.repeat(20)}`,
              txid: TXID_B,
              value: 100_000,
              vout: 1
            }
          ],
          markInputSeen: () => undefined,
          signPsbt: (psbt) => psbt
        },
        fetchImpl: () =>
          Promise.resolve({
            body: 'relay down',
            bytes: new Uint8Array(),
            status: 502
          }),
        session: {
          ...session,
          originalPsbtBase64: original.toBase64(),
          status: 'proposal_received'
        }
      })
    ).rejects.toThrow(/bip77 receiver proposal post/)
  })

  it('self-transfer bypasses payjoin even with pj URI', async () => {
    const original = buildPsbt({
      inputs: [{ txid: TXID_A, vout: 0 }],
      outputs: [{ script: changeScript, value: 90_000 }]
    })
    const fetchImpl: FetchLike = () =>
      Promise.reject(new Error('network should not be used'))

    const result = await sendPayjoin({
      callbacks: {
        hasSeenInput: () => false,
        isScriptOwned: () => true,
        listCandidateOutpoints: () => [],
        markInputSeen: () => undefined,
        signPsbt: (p) => p
      },
      fetchImpl,
      originalPsbtBase64: original.toBase64(),
      outputScriptsHex: [changeScript.toString('hex')],
      payjoinUri:
        'bitcoin:tb1qself?amount=0.0009&pjos=0&pj=https://example.com/pj',
      paymentAmountSats: 90_000
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.usedPayjoin).toBe(false)
      if (!result.usedPayjoin) {
        expect(result.reason).toBe('self-transfer')
      }
    }
  })

  it('defaults pjos=0 in built receive URIs', async () => {
    const session = await createReceivePayjoinSession({
      accountId: 'a1',
      address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      amountSats: 21_000
    })
    expect(session.pjos).toBe(0)
    expect(session.uri).toContain('pjos=0')
  })
})
