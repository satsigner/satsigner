/* eslint-disable jest/no-conditional-expect -- result is a discriminated union; assertions guarded by ok */
import * as bitcoinjs from 'bitcoinjs-lib'
import { __resetPayjoinMock } from 'react-native-payjoin'

import {
  applyManualSenderProposal,
  processManualOriginalPsbt
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
}).toBase64()

const proposal = buildPsbt({
  inputs: [
    { txid: TXID_A, vout: 0 },
    { txid: TXID_B, vout: 1 }
  ],
  outputs: [
    { script: paymentScript, value: 50_000 },
    { script: changeScript, value: 148_500 }
  ]
}).toBase64()

describe('payjoin manual (offline) helpers', () => {
  beforeEach(() => {
    __resetPayjoinMock()
  })

  describe('processManualOriginalPsbt', () => {
    it('contributes, signs, and returns a proposal PSBT with no directory call', async () => {
      const markInputSeen = jest.fn()
      const signPsbt = jest.fn((psbt: string) => `${psbt}::signed`)
      const callbacks: PayjoinWalletCallbacks = {
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
        markInputSeen,
        signPsbt
      }

      const result = await processManualOriginalPsbt({
        callbacks,
        disableOutputSubstitution: true,
        originalPsbtBase64: original,
        ownedScriptsHex: [changeScript.toString('hex')],
        receiveAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        seenOutpoints: []
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.proposalPsbtBase64).toBe(`${original}::signed`)
        expect(result.contributedOutpoint).toBe(`${TXID_B}:1`)
      }
      expect(signPsbt).toHaveBeenCalledTimes(1)
      expect(markInputSeen).toHaveBeenCalledWith(`${TXID_B}:1`)
    })

    it('fails clearly when there are no candidate inputs to contribute', async () => {
      const callbacks: PayjoinWalletCallbacks = {
        hasSeenInput: () => false,
        isScriptOwned: () => false,
        listCandidateOutpoints: () => [],
        markInputSeen: jest.fn(),
        signPsbt: (psbt) => psbt
      }

      const result = await processManualOriginalPsbt({
        callbacks,
        disableOutputSubstitution: true,
        originalPsbtBase64: original,
        ownedScriptsHex: [],
        receiveAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        seenOutpoints: []
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toMatch(/no utxos/i)
      }
    })
  })

  describe('applyManualSenderProposal', () => {
    const senderCallbacks: PayjoinWalletCallbacks = {
      hasSeenInput: () => false,
      isScriptOwned: (scriptHex) => scriptHex === changeScript.toString('hex'),
      listCandidateOutpoints: () => [],
      markInputSeen: () => {},
      signPsbt: (psbt) => `${psbt}::sender-signed`
    }

    it('validates and signs a well-formed proposal', async () => {
      const result = await applyManualSenderProposal({
        callbacks: senderCallbacks,
        disableOutputSubstitution: true,
        originalPsbtBase64: original,
        outputScriptsHex: [paymentScript.toString('hex')],
        paymentAmountSats: 50_000,
        proposalPsbtBase64: proposal
      })

      expect(result.ok).toBe(true)
      if (result.ok && result.usedPayjoin) {
        expect(result.protocol).toBe('v1')
        expect(result.psbtBase64).toBe(`${proposal}::sender-signed`)
      } else {
        throw new Error('expected a signed payjoin proposal')
      }
    })

    it('rejects a proposal that drops the original sender input (no fallback signature)', async () => {
      const tampered = buildPsbt({
        inputs: [{ txid: TXID_B, vout: 1 }],
        outputs: [
          { script: paymentScript, value: 50_000 },
          { script: changeScript, value: 48_500 }
        ]
      }).toBase64()

      const result = await applyManualSenderProposal({
        callbacks: senderCallbacks,
        disableOutputSubstitution: true,
        originalPsbtBase64: original,
        outputScriptsHex: [paymentScript.toString('hex')],
        paymentAmountSats: 50_000,
        proposalPsbtBase64: tampered
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.usedPayjoin).toBe(false)
      }
    })
  })
})
