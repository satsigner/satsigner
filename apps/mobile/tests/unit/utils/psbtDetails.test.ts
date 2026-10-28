import * as bitcoinjs from 'bitcoinjs-lib'

import * as psbtUtils from '@/utils/psbt'
import { clearPsbtDetailsCache, parsePsbtDetails } from '@/utils/psbtDetails'

import { psbts } from './nostrSamples'

// Compressed public keys of G, 2G and 3G on secp256k1.
const PUBKEYS = [
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
  '02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9'
].map((hex) => Buffer.from(hex, 'hex'))

function buildMultisigPsbt(): string {
  const redeem = bitcoinjs.payments.p2ms({ m: 2, pubkeys: PUBKEYS })
  const p2wsh = bitcoinjs.payments.p2wsh({ redeem })
  const psbt = new bitcoinjs.Psbt()
  psbt.addInput({
    hash: Buffer.alloc(32, 0x11),
    index: 0,
    witnessScript: redeem.output,
    witnessUtxo: { script: p2wsh.output ?? Buffer.alloc(0), value: 100_000 }
  })
  psbt.addOutput({ script: p2wsh.output ?? Buffer.alloc(0), value: 90_000 })
  return psbt.toBase64()
}

const MULTISIG_PSBT = buildMultisigPsbt()

describe('parsePsbtDetails', () => {
  beforeEach(() => {
    clearPsbtDetailsCache()
    jest.restoreAllMocks()
  })

  it('decodes txid, original PSBT and multisig info', () => {
    const details = parsePsbtDetails(MULTISIG_PSBT)

    expect(details).not.toBeNull()
    expect(details?.txid).toBe(
      psbtUtils.extractTransactionIdFromPSBT(MULTISIG_PSBT)
    )
    expect(details?.originalPsbt).toBe(
      psbtUtils.extractOriginalPsbt(MULTISIG_PSBT)
    )
    expect(details?.keysRequired).toBe(2)
    expect(details?.keyCount).toBe(3)
    expect(Array.isArray(details?.collectedSignatures)).toBe(true)
  })

  it('returns null for an invalid PSBT instead of throwing', () => {
    expect(parsePsbtDetails(psbts.invalid)).toBeNull()
  })

  it('caches by PSBT string', () => {
    const extractTxid = jest.spyOn(psbtUtils, 'extractTransactionIdFromPSBT')

    const first = parsePsbtDetails(MULTISIG_PSBT)
    const second = parsePsbtDetails(MULTISIG_PSBT)

    expect(second).toBe(first)
    expect(extractTxid).toHaveBeenCalledTimes(1)
  })
})
