/* eslint-disable jest/no-conditional-expect, jest/max-expects -- soft assertions when payjoin relay/fallback varies */
import * as bitcoinjs from 'bitcoinjs-lib'

import { preparePayjoinPsbtForWalletSign } from '@/utils/payjoinSign'

describe('preparePayjoinPsbtForWalletSign', () => {
  it('injects witness_utxo and non_witness_utxo for owned contribute inputs', () => {
    const network = bitcoinjs.networks.testnet
    const script = Buffer.from(`0014${'44'.repeat(20)}`, 'hex')

    const funding = new bitcoinjs.Transaction()
    funding.version = 2
    funding.addInput(Buffer.alloc(32), 0)
    funding.addOutput(script, 50_000)
    const fundingTxid = funding.getId()

    const psbt = new bitcoinjs.Psbt({ network })
    psbt.addInput({
      hash: fundingTxid,
      index: 0,
      sequence: 0xfffffffd
    })
    psbt.addOutput({
      script: Buffer.from(`0014${'22'.repeat(20)}`, 'hex'),
      value: 49_000
    })

    const prepared = preparePayjoinPsbtForWalletSign({
      getPrevTxHex: (txid) =>
        txid === fundingTxid ? funding.toHex() : undefined,
      psbtBase64: psbt.toBase64(),
      utxos: [
        {
          addressTo: '',
          keychain: 'external',
          label: '',
          script,
          txid: fundingTxid,
          value: 50_000,
          vout: 0
        }
      ]
    })

    const next = bitcoinjs.Psbt.fromBase64(prepared)
    expect(next.data.inputs[0]?.witnessUtxo?.value).toBe(50_000)
    expect(next.data.inputs[0]?.nonWitnessUtxo?.length).toBeGreaterThan(0)
  })
})
