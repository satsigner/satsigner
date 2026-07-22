import * as bitcoinjs from 'bitcoinjs-lib'

import { buildPayjoinWalletCallbacks } from '@/utils/payjoinWallet'

describe('buildPayjoinWalletCallbacks listCandidateOutpoints', () => {
  it('derives scriptHex from addressTo when utxo.script is missing', () => {
    const address = bitcoinjs.payments.p2wpkh({
      hash: Buffer.alloc(20, 0x44),
      network: bitcoinjs.networks.testnet
    }).address
    if (!address) {
      throw new Error('expected testnet address')
    }

    const callbacks = buildPayjoinWalletCallbacks({
      hasSeenInput: () => false,
      markInputSeen: () => undefined,
      network: bitcoinjs.networks.testnet,
      signPsbt: (psbt) => psbt,
      utxos: [
        {
          addressTo: address,
          keychain: 'external',
          txid: 'aa'.repeat(32),
          value: 50_000,
          vout: 0
        }
      ]
    })

    const candidates = callbacks.listCandidateOutpoints()
    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.scriptHex).toMatch(/^0014/)
    expect(candidates[0]?.value).toBe(50_000)
  })

  it('skips utxos with neither script nor addressTo', () => {
    const callbacks = buildPayjoinWalletCallbacks({
      hasSeenInput: () => false,
      markInputSeen: () => undefined,
      network: bitcoinjs.networks.testnet,
      signPsbt: (psbt) => psbt,
      utxos: [
        {
          keychain: 'external',
          txid: 'bb'.repeat(32),
          value: 50_000,
          vout: 1
        }
      ]
    })

    expect(callbacks.listCandidateOutpoints()).toHaveLength(0)
  })
})
