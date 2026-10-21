import { nip19 } from 'nostr-tools'

import { NOSTR_CONTACT_QR_SLIDE_KEYS } from '@/constants/nostr'
import {
  buildContactIdentity,
  buildContactQrSlides,
  encodeContactNprofile,
  getContactShareProfileName
} from '@/utils/nostrContactProfile'

jest.mock<typeof import('nostr-tools')>('nostr-tools', () => ({
  nip19: {
    nprofileEncode: jest.fn()
  }
}))

jest.mock<typeof import('@/locales')>('@/locales', () => ({
  t: (key: string) => key
}))

const mockedNprofileEncode = jest.mocked(nip19.nprofileEncode)

describe('encodeContactNprofile', () => {
  it('encodes pubkey with relays', () => {
    const hex = 'a'.repeat(64)
    mockedNprofileEncode.mockReturnValueOnce(`nprofile1mock${hex.slice(0, 4)}1`)

    expect(encodeContactNprofile(hex, ['wss://relay.example.com'])).toBe(
      `nprofile1mock${hex.slice(0, 4)}1`
    )
  })

  it('returns null when encoding fails', () => {
    mockedNprofileEncode.mockImplementationOnce(() => {
      throw new Error('encode failed')
    })

    expect(encodeContactNprofile('a'.repeat(64), [])).toBeNull()
  })
})

describe('buildContactQrSlides', () => {
  it('includes npub, nprofile, lud16, and silent payment placeholder', () => {
    const slides = buildContactQrSlides({
      contactNprofile: 'nprofile1test',
      lud16: 'alice@wallet.com',
      targetNpub: 'npub1test'
    })

    expect(slides.map((slide) => slide.key)).toStrictEqual([
      NOSTR_CONTACT_QR_SLIDE_KEYS.NPUB,
      NOSTR_CONTACT_QR_SLIDE_KEYS.NPROFILE,
      NOSTR_CONTACT_QR_SLIDE_KEYS.LUD16,
      NOSTR_CONTACT_QR_SLIDE_KEYS.SILENT_PAYMENT
    ])
    expect(slides[3].kind).toBe('placeholder')
  })

  it('always includes silent payment placeholder', () => {
    const slides = buildContactQrSlides({ contactNprofile: null })

    expect(slides).toHaveLength(1)
    expect(slides[0].key).toBe(NOSTR_CONTACT_QR_SLIDE_KEYS.SILENT_PAYMENT)
  })
})

describe('getContactShareProfileName', () => {
  it('masks name in privacy mode', () => {
    expect(getContactShareProfileName('Alice', true)).toBe('••••')
  })

  it('falls back to unnamed locale key', () => {
    expect(getContactShareProfileName(undefined, false)).toBe(
      'nostrIdentity.contact.unnamed'
    )
  })
})

describe('buildContactIdentity', () => {
  const npub = 'npub1contact'
  const createdAt = 1_700_000_000_000

  it('fills a watch-only identity with the kind 0 profile', () => {
    expect(
      buildContactIdentity(
        npub,
        {
          banner: 'https://example.com/banner.png',
          displayName: 'Alice',
          lud16: 'alice@example.com',
          nip05: 'alice@example.com',
          picture: 'https://example.com/alice.png'
        },
        createdAt
      )
    ).toStrictEqual({
      banner: 'https://example.com/banner.png',
      createdAt,
      displayName: 'Alice',
      isWatchOnly: true,
      lud16: 'alice@example.com',
      nip05: 'alice@example.com',
      npub,
      picture: 'https://example.com/alice.png'
    })
  })

  it('keeps only the npub when the profile is unknown', () => {
    const identity = buildContactIdentity(npub, null, createdAt)

    expect(identity).toMatchObject({ createdAt, isWatchOnly: true, npub })
    expect(identity.displayName).toBeUndefined()
    expect(identity.picture).toBeUndefined()
  })
})
