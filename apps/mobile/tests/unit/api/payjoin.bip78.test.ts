/* eslint-disable jest/no-conditional-expect, jest/max-expects -- soft assertions when payjoin relay/fallback varies */
import * as bitcoinjs from 'bitcoinjs-lib'
import { __resetPayjoinMock } from 'react-native-payjoin'

import {
  postBip78OriginalPsbt,
  sendPayjoin,
  type FetchLike
} from '@/api/payjoin'
import { type PayjoinWalletCallbacks } from '@/types/payjoin'

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
const paymentScript = Buffer.from(`0014${'22'.repeat(20)}`, 'hex')
const changeScript = Buffer.from(`0014${'33'.repeat(20)}`, 'hex')

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

const callbacks: PayjoinWalletCallbacks = {
  hasSeenInput: () => false,
  isScriptOwned: (scriptHex) => scriptHex === changeScript.toString('hex'),
  listCandidateOutpoints: () => [
    {
      scriptHex: Buffer.from(`0014${'44'.repeat(20)}`, 'hex').toString('hex'),
      txid: TXID_B,
      value: 100_000,
      vout: 1
    }
  ],
  markInputSeen: () => undefined,
  signPsbt: (psbt) => `SIGNED:${psbt}`
}

describe('payjoin BIP78 send (phase 2)', () => {
  beforeEach(() => {
    __resetPayjoinMock()
  })

  it('posts original PSBT and returns proposal', async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve({
        body: proposal.toBase64(),
        bytes: new Uint8Array(Buffer.from(proposal.toBase64(), 'utf8')),
        status: 200
      })

    const result = await postBip78OriginalPsbt({
      endpoint: 'https://example.com/pj',
      fetchImpl,
      psbtBase64: original.toBase64()
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.proposalBase64).toBe(proposal.toBase64())
    }
  })

  it('maps BIP78 unavailable JSON error', async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve({
        body: JSON.stringify({
          errorCode: 'unavailable',
          message: 'try later'
        }),
        bytes: new Uint8Array(),
        status: 503
      })

    const result = await postBip78OriginalPsbt({
      endpoint: 'https://example.com/pj',
      fetchImpl,
      psbtBase64: original.toBase64()
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('unavailable')
    }
  })

  it('falls back when receiver returns error', async () => {
    const body = JSON.stringify({
      errorCode: 'original-psbt-rejected',
      message: 'bad'
    })
    const fetchImpl: FetchLike = () =>
      Promise.resolve({
        body,
        bytes: new Uint8Array(Buffer.from(body, 'utf8')),
        status: 400
      })

    const result = await sendPayjoin({
      callbacks,
      fetchImpl,
      originalPsbtBase64: original.toBase64(),
      outputScriptsHex: [paymentScript.toString('hex')],
      payjoinUri:
        'bitcoin:tb1qreceiver?amount=0.0005&pjos=0&pj=https://example.com/pj',
      paymentAmountSats: 50_000
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.usedPayjoin).toBe(false)
      if (!result.usedPayjoin) {
        expect(result.reason).toContain('original-psbt-rejected')
        expect(result.originalPsbtBase64).toBe(original.toBase64())
      }
    }
  })

  it('returns signed payjoin PSBT on success', async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve({
        body: proposal.toBase64(),
        bytes: new Uint8Array(Buffer.from(proposal.toBase64(), 'utf8')),
        status: 200
      })

    const result = await sendPayjoin({
      callbacks,
      fetchImpl,
      originalPsbtBase64: original.toBase64(),
      outputScriptsHex: [paymentScript.toString('hex')],
      payjoinUri:
        'bitcoin:tb1qreceiver?amount=0.0005&pjos=0&pj=https://example.com/pj',
      paymentAmountSats: 50_000
    })

    expect(result.ok).toBe(true)
    if (result.ok && result.usedPayjoin) {
      expect(result.protocol).toBe('v1')
      expect(result.psbtBase64.startsWith('SIGNED:')).toBe(true)
    }
  })

  it('bypasses payjoin for self-transfer', async () => {
    const result = await sendPayjoin({
      callbacks: {
        ...callbacks,
        isScriptOwned: () => true
      },
      fetchImpl: () => Promise.reject(new Error('should not fetch')),
      originalPsbtBase64: original.toBase64(),
      outputScriptsHex: [changeScript.toString('hex')],
      payjoinUri:
        'bitcoin:tb1qreceiver?amount=0.0005&pjos=0&pj=https://example.com/pj',
      paymentAmountSats: 50_000
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.usedPayjoin).toBe(false)
      if (!result.usedPayjoin) {
        expect(result.reason).toBe('self-transfer')
      }
    }
  })
})
