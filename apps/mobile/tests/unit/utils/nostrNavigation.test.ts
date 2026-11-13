// Real nostr-tools: the shared manual mock cannot encode nprofile or nevent.
jest.mock<typeof import('nostr-tools')>('nostr-tools', () =>
  jest.requireActual('nostr-tools')
)

import { nip19 } from 'nostr-tools'

import {
  nostrAccountHref,
  nostrAccountProfileHref,
  nostrAuthorProfileHref,
  nostrBunkerConnectHref,
  nostrContactProfileHref,
  nostrFileDetailHref,
  nostrIndexHref,
  nostrNoteHref,
  nostrScannedContentHref,
  nostrZapDetailHref
} from '@/utils/nostrNavigation'

const NPUB = 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m'
const TARGET_NPUB =
  'npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg'
const HEX_ID = 'a'.repeat(64)

describe('nostrNavigation', () => {
  it('fills the dynamic segments of account routes from params', () => {
    expect(nostrAccountProfileHref(NPUB)).toStrictEqual({
      params: { npub: NPUB },
      pathname: '/signer/nostr/account/[npub]'
    })
    expect(nostrAccountHref(NPUB, 'zapSettings')).toStrictEqual({
      params: { npub: NPUB },
      pathname: '/signer/nostr/account/[npub]/zapSettings'
    })
    expect(nostrContactProfileHref(NPUB, TARGET_NPUB)).toStrictEqual({
      params: { npub: NPUB, targetNpub: TARGET_NPUB },
      pathname: '/signer/nostr/account/[npub]/contact/[targetNpub]'
    })
    expect(nostrFileDetailHref(NPUB, HEX_ID)).toStrictEqual({
      params: { npub: NPUB, sha256: HEX_ID },
      pathname: '/signer/nostr/account/[npub]/files/[sha256]'
    })
    expect(nostrZapDetailHref(NPUB, HEX_ID)).toStrictEqual({
      params: { npub: NPUB, zapId: HEX_ID },
      pathname: '/signer/nostr/account/[npub]/zap/[zapId]'
    })
  })

  it('passes query values unencoded so the router encodes them once', () => {
    const nostrUri = 'nostr:nevent1qqs?relay=wss://nos.lol&x=%20'
    const connectUri =
      'nostrconnect://abc?relay=wss%3A%2F%2Fnos.lol&name=My App'
    expect(nostrNoteHref(NPUB, nostrUri)).toStrictEqual({
      params: { nostrUri, npub: NPUB },
      pathname: '/signer/nostr/account/[npub]/note'
    })
    expect(nostrBunkerConnectHref(NPUB, connectUri)).toStrictEqual({
      params: { connectUri, npub: NPUB },
      pathname: '/signer/nostr/account/[npub]/bunker'
    })
  })

  it('links static routes by path', () => {
    expect(nostrIndexHref()).toBe('/signer/nostr')
  })

  it('opens the own profile when the author is the identity', () => {
    expect(nostrAuthorProfileHref(NPUB, NPUB)).toStrictEqual(
      nostrAccountProfileHref(NPUB)
    )
  })

  it('opens the contact profile for other authors', () => {
    expect(nostrAuthorProfileHref(NPUB, TARGET_NPUB)).toStrictEqual(
      nostrContactProfileHref(NPUB, TARGET_NPUB)
    )
  })
})

describe('nostrScannedContentHref', () => {
  function scanned(
    type: Parameters<typeof nostrScannedContentHref>[1]['type'],
    value: string
  ) {
    return { cleaned: value, raw: `nostr:${value}`, type }
  }

  it('opens a scanned npub as a contact profile', () => {
    expect(
      nostrScannedContentHref(NPUB, scanned('nostr_npub', TARGET_NPUB))
    ).toStrictEqual(nostrContactProfileHref(NPUB, TARGET_NPUB))
  })

  it('opens the own profile when the scanned npub is the identity', () => {
    expect(
      nostrScannedContentHref(NPUB, scanned('nostr_npub', NPUB))
    ).toStrictEqual(nostrAccountProfileHref(NPUB))
  })

  it('opens a scanned nprofile as the profile of its pubkey', () => {
    const decoded = nip19.decode(TARGET_NPUB)
    if (decoded.type !== 'npub') {
      throw new Error('fixture is not an npub')
    }
    const nprofile = nip19.nprofileEncode({ pubkey: decoded.data })
    expect(
      nostrScannedContentHref(NPUB, scanned('nostr_nprofile', nprofile))
    ).toStrictEqual(nostrContactProfileHref(NPUB, TARGET_NPUB))
  })

  it('opens scanned notes and bunker connections', () => {
    const nevent = nip19.neventEncode({ id: HEX_ID })
    expect(
      nostrScannedContentHref(NPUB, scanned('nostr_nevent', nevent))
    ).toStrictEqual(nostrNoteHref(NPUB, nevent))
    const connect = `nostrconnect://${HEX_ID}?relay=wss://relay.example`
    expect(
      nostrScannedContentHref(NPUB, scanned('nostr_connect', connect))
    ).toStrictEqual(nostrBunkerConnectHref(NPUB, connect))
  })

  it('opens a scanned note id', () => {
    const note = nip19.noteEncode(HEX_ID)
    expect(
      nostrScannedContentHref(NPUB, scanned('nostr_note', note))
    ).toStrictEqual(nostrNoteHref(NPUB, note))
  })

  it('rejects values that only look valid', () => {
    const badChecksum = `${TARGET_NPUB.slice(0, -1)}${
      TARGET_NPUB.endsWith('q') ? 'p' : 'q'
    }`
    expect(
      nostrScannedContentHref(NPUB, scanned('nostr_npub', badChecksum))
    ).toBeUndefined()
    const nevent = nip19.neventEncode({ id: HEX_ID })
    expect(
      nostrScannedContentHref(NPUB, scanned('nostr_note', nevent))
    ).toBeUndefined()
    expect(
      nostrScannedContentHref(
        NPUB,
        scanned('nostr_connect', 'nostrconnect://abc?relay=wss://relay.example')
      )
    ).toBeUndefined()
  })

  it('never routes a secret key or unsupported content', () => {
    expect(
      nostrScannedContentHref(NPUB, scanned('nostr_nsec', 'nsec1secret'))
    ).toBeUndefined()
    expect(
      nostrScannedContentHref(NPUB, scanned('lightning_invoice', 'lnbc1'))
    ).toBeUndefined()
  })
})
