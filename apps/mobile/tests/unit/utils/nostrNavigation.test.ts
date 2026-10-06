import { nostrAuthorProfileHref } from '@/utils/nostrNavigation'

describe('nostrAuthorProfileHref', () => {
  it('opens the own profile when the author is the identity', () => {
    expect(nostrAuthorProfileHref('npub1me', 'npub1me')).toBe(
      '/signer/nostr/account/npub1me'
    )
  })

  it('opens the contact profile for other authors', () => {
    expect(nostrAuthorProfileHref('npub1me', 'npub1them')).toBe(
      '/signer/nostr/account/npub1me/contact/npub1them'
    )
  })
})
