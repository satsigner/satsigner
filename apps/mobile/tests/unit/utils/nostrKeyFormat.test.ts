// Real nostr-tools: the shared manual mock fakes npub/nsec encoding.
jest.mock<typeof import('nostr-tools')>('nostr-tools', () =>
  jest.requireActual('nostr-tools')
)

import { hexToBytes } from '@noble/hashes/utils'
import { getPublicKey } from 'nostr-tools'

import { t } from '@/locales'
import { formatNostrKey, getNostrKeyLabel } from '@/utils/nostr'

import { nostrKeys } from './nostrSamples'

const { alice } = nostrKeys
const alicePublicKeyHex = getPublicKey(hexToBytes(alice.privateKeyHex))

describe('formatNostrKey', () => {
  it('converts an npub to its hex public key', () => {
    expect(formatNostrKey(alice.npub, 'hex')).toBe(alicePublicKeyHex)
  })

  it('converts an nsec to its hex secret key', () => {
    expect(formatNostrKey(alice.nsec, 'hex')).toBe(alice.privateKeyHex)
  })

  it('returns bech32 keys unchanged', () => {
    expect(formatNostrKey(alice.npub, 'bech32')).toBe(alice.npub)
    expect(formatNostrKey(alice.nsec, 'bech32')).toBe(alice.nsec)
  })

  it('trims surrounding whitespace', () => {
    expect(formatNostrKey(`  ${alice.npub}\n`, 'bech32')).toBe(alice.npub)
  })

  it('returns null for invalid input', () => {
    expect(formatNostrKey('not-a-key', 'hex')).toBeNull()
    expect(formatNostrKey('not-a-key', 'bech32')).toBeNull()
    expect(formatNostrKey('', 'hex')).toBeNull()
  })

  it('returns null for non-key nip19 entities', () => {
    const note =
      'note1fntxtkcy9pjwucqwa9mddn7v03wwwsu9j330jj350nvhpky2tuaspk6nqc'
    expect(formatNostrKey(note, 'bech32')).toBeNull()
  })
})

describe('getNostrKeyLabel', () => {
  it('names the key in the format it is shown in', () => {
    expect(getNostrKeyLabel('npub', 'bech32')).toBe(
      t('nostrIdentity.keys.npub')
    )
    expect(getNostrKeyLabel('npub', 'hex')).toBe(
      t('nostrIdentity.keys.npubHex')
    )
    expect(getNostrKeyLabel('nsec', 'hex')).toBe(
      t('nostrIdentity.keys.nsecHex')
    )
    expect(getNostrKeyLabel('npub', 'hex')).not.toBe(
      getNostrKeyLabel('npub', 'bech32')
    )
  })
})
