import { HOME_ROUTE } from '@/constants/navigation'
import { isBlockedExternalLink, redirectSystemPath } from '@/utils/externalLink'

describe('isBlockedExternalLink', () => {
  it.each([
    'satsigner://setPin',
    'satsigner:///setPin',
    'satsigner://setPin?source=settings',
    'satsigner://unlock',
    'satsigner://settings/changePin',
    'satsigner://settings/duressPin',
    'satsigner://(authenticated)/(tabs)/(signer)/settings/changePin',
    'satsigner://SETPIN',
    'satsigner://%73etPin',
    'satsigner://%2573etPin',
    'satsigner://set\tPin',
    'satsigner://set%09Pin',
    'satsigner://signer?__expo_url=satsigner%3A%2F%2FsetPin',
    'satsigner://expo-development-client/?url=satsigner%3A%2F%2Funlock',
    'https://example.com\\setPin'
  ])('blocks %s', (link) => {
    expect(isBlockedExternalLink(link)).toBe(true)
  })

  it.each([
    'satsigner://',
    'satsigner:///',
    'satsigner://signer/bitcoin',
    'satsigner://settings/security',
    'satsigner://warning',
    'satsigner://signer/nostr/account/npub1unlock/keys',
    'satsigner://signer?note=hello%20world'
  ])('follows %s', (link) => {
    expect(isBlockedExternalLink(link)).toBe(false)
  })

  it('blocks a link nested deeper than it decodes', () => {
    expect(isBlockedExternalLink('satsigner://signer?x=%2525252541')).toBe(true)
  })
})

describe('redirectSystemPath', () => {
  it('passes a followed link through', () => {
    expect(
      redirectSystemPath({ initial: false, path: 'satsigner://signer/ark' })
    ).toBe('satsigner://signer/ark')
  })

  it('opens home when the app launches from a blocked link', () => {
    expect(
      redirectSystemPath({ initial: true, path: 'satsigner://setPin' })
    ).toBe(HOME_ROUTE)
  })

  it('ignores a blocked link while the app runs', () => {
    expect(
      redirectSystemPath({ initial: false, path: 'satsigner://setPin' })
    ).toBeNull()
  })
})
