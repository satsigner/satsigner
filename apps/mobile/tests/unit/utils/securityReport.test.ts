// Real nostr-tools: the shared manual mock fakes npub/nsec encoding.
jest.mock<typeof import('nostr-tools')>('nostr-tools', () =>
  jest.requireActual('nostr-tools')
)

import { getPublicKey, nip19 } from 'nostr-tools'

import { validateMnemonic } from '@/utils/bip39'
import { getSecretFromNsec } from '@/utils/nostr'
import {
  createThrowawayIdentity,
  getSecurityReportNpub
} from '@/utils/securityReport'

describe('createThrowawayIdentity', () => {
  it('produces a valid 12-word mnemonic with matching nsec/npub', () => {
    const identity = createThrowawayIdentity()

    expect(identity.mnemonic.split(' ')).toHaveLength(12)
    expect(validateMnemonic(identity.mnemonic)).toBe(true)
    expect(identity.nsec.startsWith('nsec1')).toBe(true)
    expect(identity.npub.startsWith('npub1')).toBe(true)

    // nsec decodes to the secret key whose public key matches the npub
    const secretKey = getSecretFromNsec(identity.nsec)
    expect(secretKey).not.toBeNull()
    const npubFromSecret = nip19.npubEncode(getPublicKey(secretKey!))
    expect(npubFromSecret).toBe(identity.npub)
  })

  it('generates distinct identities', () => {
    const a = createThrowawayIdentity()
    const b = createThrowawayIdentity()
    expect(a.mnemonic).not.toBe(b.mnemonic)
    expect(a.npub).not.toBe(b.npub)
  })

  it('report destination is the SECURITY.md project npub', () => {
    expect(getSecurityReportNpub()).toBe(
      'npub1ewv0j6l7fplmadqmcmdywkff2snham403sensqlqavymt7fx7jfs58e60d'
    )
  })
})
