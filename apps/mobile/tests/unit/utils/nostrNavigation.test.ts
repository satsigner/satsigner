import {
  nostrAccountHref,
  nostrAccountProfileHref,
  nostrBunkerConnectHref,
  nostrContactProfileHref,
  nostrFileDetailHref,
  nostrIndexHref,
  nostrNoteHref,
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
})
