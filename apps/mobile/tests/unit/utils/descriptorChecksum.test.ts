import { isDescriptorChecksumValid } from '@/utils/descriptorChecksum'

import {
  COSIGNER_KEY_DESCRIPTOR,
  P2WSH_MULTISIG_APOSTROPHE_DESCRIPTOR,
  P2WSH_MULTISIG_DESCRIPTOR
} from './multisigDescriptorSamples'

const [KEY_DESCRIPTOR_BODY] = COSIGNER_KEY_DESCRIPTOR.split('#')

describe('isDescriptorChecksumValid', () => {
  it.each([
    COSIGNER_KEY_DESCRIPTOR,
    P2WSH_MULTISIG_DESCRIPTOR,
    P2WSH_MULTISIG_APOSTROPHE_DESCRIPTOR
  ])('accepts the BIP-380 checksum of %s', (descriptor) => {
    expect(isDescriptorChecksumValid(descriptor)).toBe(true)
  })

  it('accepts a descriptor without a checksum', () => {
    expect(isDescriptorChecksumValid(KEY_DESCRIPTOR_BODY)).toBe(true)
  })

  it.each(['vd4fy20q', 'zzzzzzzz', 'vd4fy20', 'vd4fy20jj', ''])(
    'rejects the checksum "%s"',
    (checksum) => {
      expect(
        isDescriptorChecksumValid(`${KEY_DESCRIPTOR_BODY}#${checksum}`)
      ).toBe(false)
    }
  )

  it('rejects a fingerprint typo that keeps the old checksum', () => {
    const descriptor = COSIGNER_KEY_DESCRIPTOR.replace('73c5da0a', '73c5da0b')

    expect(isDescriptorChecksumValid(descriptor)).toBe(false)
  })

  it("does not treat ' and h as the same text", () => {
    const [, hChecksum] = P2WSH_MULTISIG_DESCRIPTOR.split('#')
    const [apostropheBody] = P2WSH_MULTISIG_APOSTROPHE_DESCRIPTOR.split('#')

    expect(isDescriptorChecksumValid(`${apostropheBody}#${hChecksum}`)).toBe(
      false
    )
  })

  it('rejects characters a checksum cannot cover', () => {
    expect(isDescriptorChecksumValid('raw(deadbeef)é#89f8spxm')).toBe(false)
  })
})
