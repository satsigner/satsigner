import * as ecc from '@bitcoinerlab/secp256k1'
import * as bitcoinjs from 'bitcoinjs-lib'

import { type Account, type Key } from '@/types/models/Account'
import {
  bindImportedSignature,
  combinePsbts,
  createPlaceholderTransactionId,
  bindScannedDataToPsbt,
  buildPubkeyToCosignerIndex,
  combineAndFinalizePsbts,
  extractTransactionDataFromPSBT,
  getCollectedSignedPsbts,
  getPsbtTxidOrFallback,
  hasAllRequiredSignatures,
  hasEnoughSignatures,
  normalizePsbtToBase64,
  parseWitnessScript,
  readPartiallySignedPsbt,
  signedTransactionMatchesPsbt
} from '@/utils/psbt'

const TEST_PUBKEY_HEX =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'

function testP2wpkhAddress(network: bitcoinjs.Network): string {
  const { address } = bitcoinjs.payments.p2wpkh({
    network,
    pubkey: Buffer.from(TEST_PUBKEY_HEX, 'hex')
  })
  if (!address) {
    throw new Error('Expected a P2WPKH address for the test pubkey')
  }
  return address
}

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
  const address = testP2wpkhAddress(network)
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

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('Missing test fixture value')
  }
  return value
}

describe('multisig witness script helpers', () => {
  const pubkeys = [
    '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
    '02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9'
  ].map((pubkey) => Buffer.from(pubkey, 'hex'))
  const witnessScript = required(
    bitcoinjs.payments.p2ms({ m: 2, pubkeys }).output
  )

  const signature = { pubkey: pubkeys[0], signature: Buffer.alloc(71) }

  it('reads the m-of-n of a multisig script', () => {
    expect(parseWitnessScript(witnessScript)).toStrictEqual({
      threshold: 2,
      totalKeys: 3
    })
  })

  it('returns null for a non-multisig script', () => {
    expect(parseWitnessScript(Buffer.from('6a', 'hex'))).toBeNull()
  })

  it('treats inputs without a witness script as ready', () => {
    expect(hasEnoughSignatures({})).toBe(true)
  })

  it('requires the threshold number of partial signatures', () => {
    expect(
      hasEnoughSignatures({ partialSig: [signature], witnessScript })
    ).toBe(false)
    expect(
      hasEnoughSignatures({
        partialSig: [signature, signature],
        witnessScript
      })
    ).toBe(true)
  })
})

describe('getCollectedSignedPsbts', () => {
  it('drops cosigners with an empty signed PSBT', () => {
    const collected = getCollectedSignedPsbts(
      new Map([
        [0, 'cHNidP8B'],
        [1, '  '],
        [2, '']
      ])
    )
    expect(Array.from(collected.keys())).toStrictEqual([0])
  })
})

describe('hasAllRequiredSignatures', () => {
  const key: Key = {
    creationType: 'generateMnemonic',
    index: 0,
    iv: '',
    secret: ''
  }
  const account: Account = {
    addresses: [],
    createdAt: new Date('2024-01-01'),
    id: 'acc-1',
    keyCount: 3,
    keys: [key, key, key],
    keysRequired: 2,
    labels: {},
    name: 'Test',
    network: 'bitcoin',
    nostr: {
      autoSync: false,
      commonNpub: '',
      commonNsec: '',
      dms: [],
      lastUpdated: new Date(),
      relays: [],
      syncStart: new Date(),
      trustedMemberDevices: []
    },
    policyType: 'multisig',
    summary: {
      balance: 0,
      numberOfAddresses: 0,
      numberOfTransactions: 0,
      numberOfUtxos: 0,
      satsInMempool: 0
    },
    syncStatus: 'synced',
    transactions: [],
    utxos: []
  }

  it('is true once enough signatures are valid', () => {
    const results = new Map([
      [0, true],
      [1, false],
      [2, true]
    ])
    expect(hasAllRequiredSignatures(account, results)).toBe(true)
  })

  it('is false below the threshold or without an account', () => {
    expect(hasAllRequiredSignatures(account, new Map([[0, true]]))).toBe(false)
    expect(hasAllRequiredSignatures(undefined, new Map([[0, true]]))).toBe(
      false
    )
  })
})

describe('getPsbtTxidOrFallback', () => {
  it('prefers the PSBT txid', () => {
    expect(getPsbtTxidOrFallback({ txid: () => 'abc' }, 'fallback')).toBe('abc')
  })

  it('falls back when missing or failing', () => {
    expect(getPsbtTxidOrFallback(undefined, 'fallback')).toBe('fallback')
    expect(
      getPsbtTxidOrFallback(
        {
          txid: () => {
            throw new Error('no txid')
          }
        },
        'fallback'
      )
    ).toBe('fallback')
  })
})

describe('2-of-2 multisig signatures', () => {
  const pubkeys = [
    '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5'
  ].map((pubkey) => Buffer.from(pubkey, 'hex'))
  const p2wsh = bitcoinjs.payments.p2wsh({
    redeem: bitcoinjs.payments.p2ms({ m: 2, pubkeys })
  })

  function buildMultisigPsbt() {
    const psbt = new bitcoinjs.Psbt()
    psbt.addInput({
      hash: Buffer.alloc(32, 0x11),
      index: 0,
      witnessScript: p2wsh.redeem?.output,
      witnessUtxo: { script: required(p2wsh.output), value: 100_000 }
    })
    psbt.addOutput({ script: required(p2wsh.output), value: 90_000 })
    return psbt.toBase64()
  }

  it('reports missing signed PSBTs', () => {
    expect(combineAndFinalizePsbts(buildMultisigPsbt(), [])).toStrictEqual({
      errorKey: 'common.error.noSignedPSBTs'
    })
  })

  it('reports which signed PSBT fails to combine', () => {
    expect(
      combineAndFinalizePsbts(buildMultisigPsbt(), ['not-a-psbt'])
    ).toStrictEqual({
      errorKey: 'transaction.preview.errorCombiningPsbt',
      errorParams: { index: 1 }
    })
  })

  it('reports inputs below the signature threshold', () => {
    const psbt = buildMultisigPsbt()
    expect(combineAndFinalizePsbts(psbt, [psbt])).toStrictEqual({
      errorKey: 'transaction.preview.notEnoughSignatures'
    })
  })

  // The test pubkeys are G and 2G, so private keys 1 and 2 sign for them.
  const signers = [1, 2].map((scalar, index) => {
    const privateKey = Buffer.alloc(32)
    privateKey[31] = scalar
    return {
      publicKey: pubkeys[index],
      sign: (hash: Buffer) => Buffer.from(ecc.sign(hash, privateKey))
    }
  })

  function signAll(psbtBase64: string) {
    return signers.map((signer) =>
      bitcoinjs.Psbt.fromBase64(psbtBase64).signInput(0, signer).toBase64()
    )
  }

  it('finalizes once every cosigner has signed', () => {
    const original = buildMultisigPsbt()

    expect(combineAndFinalizePsbts(original, signAll(original))).toStrictEqual({
      hex: expect.stringMatching(/^[0-9a-f]+$/)
    })
  })

  it('keeps a fully signed PSBT imported into a cosigner slot unfinalized', () => {
    const original = buildMultisigPsbt()
    const fullySigned = combinePsbts(signAll(original))
    const finalize = jest.fn(() => 'final-tx-hex')

    const bound = bindImportedSignature(fullySigned, original, false, finalize)

    expect(finalize).not.toHaveBeenCalled()
    expect(
      bitcoinjs.Psbt.fromBase64(required(bound)).data.inputs[0].partialSig
    ).toHaveLength(2)
  })

  it('rejects a cosigner PSBT for a different transaction', () => {
    const original = buildMultisigPsbt()
    const other = bitcoinjs.Psbt.fromBase64(original)
    other.addOutput({ script: required(p2wsh.output), value: 1000 })

    expect(
      bindImportedSignature(other.toBase64(), original, false, jest.fn())
    ).toBeNull()
  })

  it('rejects a raw transaction imported into a cosigner slot', () => {
    const original = buildMultisigPsbt()
    const unsignedTxHex = bitcoinjs.Transaction.fromBuffer(
      bitcoinjs.Psbt.fromBase64(original).data.globalMap.unsignedTx.toBuffer()
    ).toHex()

    expect(
      bindImportedSignature(unsignedTxHex, original, false, jest.fn())
    ).toBeNull()
  })

  it('finalizes a PSBT imported for watch-only broadcast', () => {
    const original = buildMultisigPsbt()
    const finalize = jest.fn(() => 'final-tx-hex')

    expect(bindImportedSignature(original, original, true, finalize)).toBe(
      'final-tx-hex'
    )
  })
})

describe('bindScannedDataToPsbt', () => {
  const network = bitcoinjs.networks.bitcoin
  const address = required(
    bitcoinjs.payments.p2wpkh({
      network,
      pubkey: Buffer.from(
        '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
        'hex'
      )
    }).address
  )
  const psbt = new bitcoinjs.Psbt()
  psbt.addInput({ hash: Buffer.alloc(32, 0x11), index: 0 })
  psbt.addOutput({ address, value: 90_000 })
  const psbtBase64 = psbt.toBase64()
  const unsignedTxHex = bitcoinjs.Transaction.fromBuffer(
    psbt.data.globalMap.unsignedTx.toBuffer()
  ).toHex()
  const convert = jest.fn((psbtHex: string) => `final:${psbtHex}`)

  it('combines a hex PSBT with the PSBT under review', () => {
    const psbtHex = psbt.toHex()
    expect(bindScannedDataToPsbt(psbtHex, psbtBase64, convert)).toBe(
      `final:${psbtHex}`
    )
  })

  it('passes a hex PSBT through when nothing is under review', () => {
    const psbtHex = psbt.toHex()
    expect(bindScannedDataToPsbt(psbtHex, undefined, convert)).toBe(psbtHex)
  })

  it('accepts a matching transaction and strips the bitcoin: prefix', () => {
    expect(
      bindScannedDataToPsbt(`bitcoin:${unsignedTxHex}`, psbtBase64, convert)
    ).toBe(unsignedTxHex)
  })

  it('rejects a transaction that does not match', () => {
    const tx = bitcoinjs.Transaction.fromHex(unsignedTxHex)
    tx.outs[0].value = 10
    expect(bindScannedDataToPsbt(tx.toHex(), psbtBase64, convert)).toBeNull()
  })

  it('accepts a matching transaction pasted with a trailing newline', () => {
    expect(
      bindScannedDataToPsbt(`${unsignedTxHex}\n`, psbtBase64, convert)
    ).toBe(unsignedTxHex)
  })

  it('rejects data that is neither a PSBT nor a transaction', () => {
    expect(bindScannedDataToPsbt('hello', psbtBase64, convert)).toBeNull()
  })

  it('binds a base64 PSBT like a hex one', () => {
    expect(bindScannedDataToPsbt(psbtBase64, psbtBase64, convert)).toBe(
      `final:${psbt.toHex()}`
    )
  })

  it('rejects a PSBT the conversion refuses as a mismatch', () => {
    const throwingConvert = () => {
      throw new Error('mismatch')
    }
    expect(
      bindScannedDataToPsbt(psbt.toHex(), psbtBase64, throwingConvert)
    ).toBeNull()
  })
})

describe('buildPubkeyToCosignerIndex', () => {
  const pubkey = Buffer.from(
    '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    'hex'
  )

  it('maps derivation pubkeys to the key with the same fingerprint', () => {
    const psbt = new bitcoinjs.Psbt()
    psbt.addInput({
      bip32Derivation: [
        {
          masterFingerprint: Buffer.from('aabbccdd', 'hex'),
          path: "m/48'/0'/0'/2'/0/0",
          pubkey
        }
      ],
      hash: Buffer.alloc(32, 0x11),
      index: 0
    })

    const map = buildPubkeyToCosignerIndex(psbt, ['11223344', 'aabbccdd'])

    expect(map.get(pubkey.toString('hex'))).toBe(1)
  })

  it('ignores derivations from unknown fingerprints', () => {
    const psbt = new bitcoinjs.Psbt()
    psbt.addInput({
      bip32Derivation: [
        {
          masterFingerprint: Buffer.from('aabbccdd', 'hex'),
          path: "m/48'/0'/0'/2'/0/0",
          pubkey
        }
      ],
      hash: Buffer.alloc(32, 0x11),
      index: 0
    })

    expect(buildPubkeyToCosignerIndex(psbt, ['11223344']).size).toBe(0)
  })
})

describe('extractTransactionDataFromPSBT', () => {
  const network = bitcoinjs.networks.bitcoin
  const address = testP2wpkhAddress(network)
  const script = bitcoinjs.address.toOutputScript(address, network)

  it('reads input values from witness and non-witness UTXOs', () => {
    const prevTx = new bitcoinjs.Transaction()
    prevTx.addInput(Buffer.alloc(32, 0x22), 0)
    prevTx.addOutput(script, 50_000)

    const psbt = new bitcoinjs.Psbt({ network })
    psbt.addInput({
      hash: Buffer.alloc(32, 0x11),
      index: 0,
      witnessUtxo: { script, value: 100_000 }
    })
    psbt.addInput({
      hash: prevTx.getHash(),
      index: 0,
      nonWitnessUtxo: prevTx.toBuffer()
    })
    psbt.addOutput({ address, value: 140_000 })

    const data = extractTransactionDataFromPSBT(psbt.toBase64(), 'bitcoin')

    expect(data?.inputs.map((input) => input.value)).toStrictEqual([
      100_000, 50_000
    ])
    expect(data?.inputs.map((input) => input.address)).toStrictEqual([
      address,
      address
    ])
    expect(data?.fee).toBe(10_000)
    expect(data?.network).toBe('mainnet')
  })
})

describe('readPartiallySignedPsbt', () => {
  // Shortest DER signature (r = s = 1) followed by SIGHASH_ALL.
  const MINIMAL_DER_SIGNATURE_HEX = '300602010102010101'
  const pubkey = Buffer.from(TEST_PUBKEY_HEX, 'hex')
  const script = bitcoinjs.payments.p2wpkh({ pubkey }).output

  function buildPsbt() {
    const psbt = new bitcoinjs.Psbt()
    psbt.addInput({
      hash: Buffer.alloc(32, 0x11),
      index: 0,
      witnessUtxo: { script: required(script), value: 100_000 }
    })
    psbt.addOutput({ script: required(script), value: 90_000 })
    return psbt
  }

  it('returns the psbt and its unsigned original once signed', () => {
    const psbt = buildPsbt()
    const unsigned = psbt.toBase64()
    psbt.updateInput(0, {
      partialSig: [
        { pubkey, signature: Buffer.from(MINIMAL_DER_SIGNATURE_HEX, 'hex') }
      ]
    })

    const signed = readPartiallySignedPsbt(psbt.toBase64())

    expect(signed?.originalPsbtBase64).toBe(unsigned)
  })

  it('is null for unsigned or unreadable data', () => {
    expect(readPartiallySignedPsbt(buildPsbt().toBase64())).toBeNull()
    expect(readPartiallySignedPsbt('not-a-psbt')).toBeNull()
  })
})

describe('createPlaceholderTransactionId', () => {
  it('prefixes the id with PSBT and the optional tag', () => {
    expect(createPlaceholderTransactionId()).toMatch(/^PSBT-[0-9a-z]+$/)
    expect(createPlaceholderTransactionId('ERROR')).toMatch(
      /^PSBT-ERROR-[0-9a-z]+$/
    )
  })
})
