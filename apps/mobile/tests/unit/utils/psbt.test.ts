import * as bitcoinjs from 'bitcoinjs-lib'

import {
  normalizePsbtToBase64,
  signedTransactionMatchesPsbt
} from '@/utils/psbt'

describe('normalizePsbtToBase64', () => {
  const PSBT_MAGIC_HEX = '70736274ff'
  const PSBT_MAGIC_BASE64 = 'cHNidP'

  it('converts hex PSBT with magic prefix to base64', () => {
    const hexPsbt = `${PSBT_MAGIC_HEX}01000000`
    const result = normalizePsbtToBase64(hexPsbt)
    expect(result).toBe(Buffer.from(hexPsbt, 'hex').toString('base64'))
  })

  it('converts uppercase hex PSBT with magic prefix to base64', () => {
    const hexPsbt = `${PSBT_MAGIC_HEX.toUpperCase()}01000000`
    const result = normalizePsbtToBase64(hexPsbt)
    expect(result).toBe(Buffer.from(hexPsbt, 'hex').toString('base64'))
  })

  it('returns base64 PSBT as-is', () => {
    const base64Psbt = `${PSBT_MAGIC_BASE64}AAAAAAAAAA==`
    const result = normalizePsbtToBase64(base64Psbt)
    expect(result).toBe(base64Psbt)
  })

  it('converts generic long hex string to base64', () => {
    const longHex = 'ab'.repeat(60)
    const result = normalizePsbtToBase64(longHex)
    expect(result).toBe(Buffer.from(longHex, 'hex').toString('base64'))
  })

  it('returns short hex string as-is', () => {
    const shortHex = 'abcdef'
    const result = normalizePsbtToBase64(shortHex)
    expect(result).toBe(shortHex)
  })

  it('returns non-hex string as-is', () => {
    const notHex = 'not-a-hex-string-with-dashes-and-stuff-that-is-long-enough'
    const result = normalizePsbtToBase64(notHex)
    expect(result).toBe(notHex)
  })
})

describe('signedTransactionMatchesPsbt', () => {
  const network = bitcoinjs.networks.bitcoin
  const address = bitcoinjs.payments.p2wpkh({
    network,
    pubkey: Buffer.from(
      '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
      'hex'
    )
  }).address as string
  const script = bitcoinjs.address.toOutputScript(address, network)

  function buildPsbt() {
    const psbt = new bitcoinjs.Psbt()
    psbt.setVersion(2)
    psbt.addInput({
      hash: Buffer.alloc(32, 0x11),
      index: 0,
      witnessUtxo: { script, value: 100_000 }
    })
    psbt.addOutput({ address, value: 90_000 })
    psbt.addOutput({ address, value: 5_000 })
    return psbt
  }

  function unsignedTxHexOf(psbt: bitcoinjs.Psbt): string {
    return bitcoinjs.Transaction.fromBuffer(
      psbt.data.globalMap.unsignedTx.toBuffer()
    ).toHex()
  }

  it('matches a final transaction built from the same skeleton', () => {
    const psbt = buildPsbt()
    expect(
      signedTransactionMatchesPsbt(psbt.toBase64(), unsignedTxHexOf(psbt))
    ).toBe(true)
  })

  it('rejects a transaction paying different amounts', () => {
    const psbt = buildPsbt()
    const tx = bitcoinjs.Transaction.fromBuffer(
      psbt.data.globalMap.unsignedTx.toBuffer()
    )
    tx.outs[0].value = 10 // attacker reroutes nearly everything to fees
    expect(signedTransactionMatchesPsbt(psbt.toBase64(), tx.toHex())).toBe(
      false
    )
  })

  it('rejects a transaction with a substituted output script', () => {
    const psbt = buildPsbt()
    const tx = bitcoinjs.Transaction.fromBuffer(
      psbt.data.globalMap.unsignedTx.toBuffer()
    )
    tx.outs[1].script = Buffer.from('6a24aa21a9ed', 'hex') // OP_RETURN
    expect(signedTransactionMatchesPsbt(psbt.toBase64(), tx.toHex())).toBe(
      false
    )
  })

  it('rejects a transaction spending different inputs', () => {
    const psbt = buildPsbt()
    const tx = bitcoinjs.Transaction.fromBuffer(
      psbt.data.globalMap.unsignedTx.toBuffer()
    )
    tx.ins[0].hash = Buffer.alloc(32, 0x22)
    expect(signedTransactionMatchesPsbt(psbt.toBase64(), tx.toHex())).toBe(
      false
    )
  })

  it('rejects malformed input', () => {
    const psbt = buildPsbt()
    expect(signedTransactionMatchesPsbt(psbt.toBase64(), 'deadbeef')).toBe(
      false
    )
    expect(
      signedTransactionMatchesPsbt('not-a-psbt', unsignedTxHexOf(psbt))
    ).toBe(false)
  })
})
