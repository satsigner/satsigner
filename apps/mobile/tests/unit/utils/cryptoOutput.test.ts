import { decodeCryptoOutputCbor } from '@/utils/cryptoOutput'
import { decodeURGeneric } from '@/utils/ur'

const VECTOR_1_HEX =
  'd90193d90132a103582102c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5'

const VECTOR_2_HEX =
  'd90190d90194d90132a103582103fff97bd5755eeea420453a14355235d382f6472f8568a18b2f057a1460297556'

const VECTOR_4_HEX =
  'd90193d9012fa503582102d2b36900396c9282fa14628566582f206a5dd0bcc8d5e892611806cafb0301f0045820637807030d55d01f9a0cb3a7839515d796bd07706386a6eddf06cc29a65a0e2906d90130a30186182cf500f500f5021ad34db33f030407d90130a1018401f480f4081a78412e3a'

const VECTOR_4_UR =
  'ur:crypto-output/taadmutaaddlonaxhdclaotdqdinaeesjzmolfzsbbidlpiyhddlcximhltirfsptlvsmohscsamsgzoaxadwtaahdcxiaksataxbtgotictnybnqdoslsmdbztsmtryatjoialnolweuramsfdtolhtbadtamtaaddyotadlncsdwykaeykaeykaocytegtqdfhaxaaattaaddyoyadlradwklawkaycyksfpdmftkiiozsfd'

describe('crypto-output descriptors', () => {
  it('decodes pkh(compressed pubkey)', () => {
    const descriptor = decodeCryptoOutputCbor(Buffer.from(VECTOR_1_HEX, 'hex'))
    expect(descriptor).toBe(
      'pkh(02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5)'
    )
  })

  it('decodes nested sh(wpkh(...))', () => {
    const descriptor = decodeCryptoOutputCbor(Buffer.from(VECTOR_2_HEX, 'hex'))
    expect(descriptor).toBe(
      'sh(wpkh(03fff97bd5755eeea420453a14355235d382f6472f8568a18b2f057a1460297556))'
    )
  })

  it('decodes an HD key with origin and children', () => {
    const descriptor = decodeCryptoOutputCbor(Buffer.from(VECTOR_4_HEX, 'hex'))
    expect(descriptor).toMatch(
      /^pkh\(\[d34db33f\/44'\/0'\/0'\]xpub[a-zA-Z0-9]+\/1\/\*\)$/
    )
  })

  it('decodes a UR:crypto-output fragment to a descriptor', () => {
    const decoded = decodeURGeneric(VECTOR_4_UR)
    expect(decoded.startsWith("pkh([d34db33f/44'/0'/0']xpub")).toBe(true)
    expect(decoded.endsWith('/1/*)')).toBe(true)
  })
})
