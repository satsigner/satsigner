import {
  NostrNoRelaysError,
  NostrPartialSendError,
  NostrPublishError,
  NostrRelayTimeoutError
} from '@/utils/errors'
import {
  getNostrErrorCode,
  getNostrErrorMessage
} from '@/utils/nostrErrorMessage'

describe('nostrErrorMessage', () => {
  it('maps typed nostr errors to codes', () => {
    expect(getNostrErrorCode(new NostrNoRelaysError('x'))).toBe('noRelays')
    expect(getNostrErrorCode(new NostrRelayTimeoutError('x'))).toBe('timeout')
    expect(
      getNostrErrorCode(
        new NostrPublishError([{ reason: 'blocked', url: 'wss://a' }])
      )
    ).toBe('publishFailed')
    expect(getNostrErrorCode(new Error('raw'))).toBe('unknown')
  })

  it('never exposes raw relay error text', () => {
    const message = getNostrErrorMessage(
      new NostrPublishError([{ reason: 'blocked: spam', url: 'wss://a' }])
    )

    expect(message).not.toContain('wss://a')
    expect(message).not.toContain('blocked')
  })

  it('reports partial sends with counts', () => {
    const message = getNostrErrorMessage(
      new NostrPartialSendError(['npub1a'], ['npub1b', 'npub1c'])
    )

    expect(message).toContain('1')
    expect(message).toContain('3')
  })
})
