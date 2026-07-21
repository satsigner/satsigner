import * as bitcoinjs from 'bitcoinjs-lib'

import {
  isSelfTransfer,
  parseBip78ErrorBody,
  validatePayjoinProposal
} from '@/utils/payjoinValidate'

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
const receiverInputScript = Buffer.from('0014' + '44'.repeat(20), 'hex')

describe('payjoinValidate', () => {
  describe('parseBip78ErrorBody', () => {
    it('parses well-known error codes', () => {
      const err = parseBip78ErrorBody(
        JSON.stringify({
          errorCode: 'unavailable',
          message: 'Receiver offline'
        })
      )
      expect(err.errorCode).toBe('unavailable')
      expect(err.message).toBe('Receiver offline')
    })

    it('falls back to unknown for plain text', () => {
      expect(parseBip78ErrorBody('nope').errorCode).toBe('unknown')
    })
  })

  describe('isSelfTransfer', () => {
    it('returns true when all outputs are owned', () => {
      expect(
        isSelfTransfer({
          isScriptOwned: () => true,
          outputScriptsHex: ['aa', 'bb']
        })
      ).toBe(true)
    })

    it('returns false when any output is external', () => {
      expect(
        isSelfTransfer({
          isScriptOwned: (s) => s === 'aa',
          outputScriptsHex: ['aa', 'bb']
        })
      ).toBe(false)
    })
  })

  describe('validatePayjoinProposal', () => {
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
        { script: changeScript, value: 48_500 },
        { script: receiverInputScript, value: 100_000 }
      ]
    })

    // Re-build proposal with same output count for pjos=0 happy path
    const proposalPjos0 = buildPsbt({
      inputs: [
        { txid: TXID_A, vout: 0 },
        { txid: TXID_B, vout: 1 }
      ],
      outputs: [
        { script: paymentScript, value: 50_000 },
        { script: changeScript, value: 148_500 }
      ]
    })

    it('accepts a valid pjos=0 proposal', () => {
      const result = validatePayjoinProposal({
        disableOutputSubstitution: true,
        isScriptOwned: (scriptHex) => scriptHex === changeScript.toString('hex'),
        originalPsbtBase64: original.toBase64(),
        paymentAmountSats: 50_000,
        proposalPsbtBase64: proposalPjos0.toBase64()
      })
      expect(result.ok).toBe(true)
    })

    it('rejects when original input is missing', () => {
      const bad = buildPsbt({
        inputs: [{ txid: TXID_B, vout: 1 }],
        outputs: [{ script: paymentScript, value: 50_000 }]
      })
      const result = validatePayjoinProposal({
        disableOutputSubstitution: false,
        isScriptOwned: () => false,
        originalPsbtBase64: original.toBase64(),
        paymentAmountSats: 50_000,
        proposalPsbtBase64: bad.toBase64()
      })
      expect(result.ok).toBe(false)
    })

    it('rejects proposal with no receiver input', () => {
      const result = validatePayjoinProposal({
        disableOutputSubstitution: true,
        isScriptOwned: () => false,
        originalPsbtBase64: original.toBase64(),
        paymentAmountSats: 50_000,
        proposalPsbtBase64: original.toBase64()
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toContain('no receiver input')
      }
    })

    it('rejects output script substitution when pjos=0', () => {
      const substituted = buildPsbt({
        inputs: [
          { txid: TXID_A, vout: 0 },
          { txid: TXID_B, vout: 1 }
        ],
        outputs: [
          {
            script: Buffer.from('0014' + '55'.repeat(20), 'hex'),
            value: 50_000
          },
          { script: changeScript, value: 148_500 }
        ]
      })
      const result = validatePayjoinProposal({
        disableOutputSubstitution: true,
        isScriptOwned: () => false,
        originalPsbtBase64: original.toBase64(),
        paymentAmountSats: 50_000,
        proposalPsbtBase64: substituted.toBase64()
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toContain('substituted')
      }
    })

    it('allows extra outputs when substitution enabled', () => {
      const result = validatePayjoinProposal({
        disableOutputSubstitution: false,
        isScriptOwned: (scriptHex) => scriptHex === changeScript.toString('hex'),
        originalPsbtBase64: original.toBase64(),
        paymentAmountSats: 50_000,
        proposalPsbtBase64: proposal.toBase64()
      })
      expect(result.ok).toBe(true)
    })
  })
})
