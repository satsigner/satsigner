// Real nostr-tools: the shared manual mock fakes npub/nsec encoding.
jest.mock<typeof import('nostr-tools')>('nostr-tools', () =>
  jest.requireActual('nostr-tools')
)

import { hexToBytes } from '@noble/hashes/utils'
import { getPublicKey } from 'nostr-tools'

import { t } from '@/locales'
import { formatNostrKey, getNostrKeyLabel, getNostrKeyQr } from '@/utils/nostr'

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

describe('getNostrKeyQr', () => {
  const LN_ADDRESS = 'alice@example.com'

  it('shows the bech32 key named after its type', () => {
    expect(getNostrKeyQr(alice.npub, 'bech32')).toStrictEqual({
      format: 'bech32',
      label: t('nostrIdentity.keys.npub'),
      value: alice.npub
    })
    expect(getNostrKeyQr(alice.nsec, 'bech32')).toStrictEqual({
      format: 'bech32',
      label: t('nostrIdentity.keys.nsec'),
      value: alice.nsec
    })
  })

  it('shows the hex form of a public or secret key', () => {
    expect(getNostrKeyQr(alice.npub, 'hex')).toStrictEqual({
      format: 'hex',
      label: t('nostrIdentity.keys.npubHex'),
      value: alicePublicKeyHex
    })
    expect(getNostrKeyQr(alice.nsec, 'hex')).toStrictEqual({
      format: 'hex',
      label: t('nostrIdentity.keys.nsecHex'),
      value: alice.privateKeyHex
    })
  })

  it('shows the lightning address when there is one', () => {
    expect(getNostrKeyQr(alice.npub, 'lnaddress', LN_ADDRESS)).toStrictEqual({
      format: 'lnaddress',
      label: t('nostrIdentity.keys.lnaddress'),
      value: LN_ADDRESS
    })
  })

  it('falls back to the bech32 key when the format has nothing to show', () => {
    expect(getNostrKeyQr(alice.npub, 'lnaddress').format).toBe('bech32')
    expect(getNostrKeyQr('not-a-key', 'hex')).toStrictEqual({
      format: 'bech32',
      label: t('nostrIdentity.keys.npub'),
      value: 'not-a-key'
    })
  })
})
