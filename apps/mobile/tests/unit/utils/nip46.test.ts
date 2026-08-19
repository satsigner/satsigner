import { canAutoApproveRequest, getEventPreview } from '@/utils/nip46'

function signEventParams(template: object): string[] {
  return [JSON.stringify(template)]
}

describe('canAutoApproveRequest', () => {
  it('never auto-approves decryption methods (decryption oracle)', () => {
    expect(canAutoApproveRequest('nip04_decrypt', ['pubkey', 'ct'])).toBe(false)
    expect(canAutoApproveRequest('nip44_decrypt', ['pubkey', 'ct'])).toBe(false)
  })

  it('auto-approves low-risk sign_event kinds', () => {
    for (const kind of [1, 6, 7, 16, 9734]) {
      expect(
        canAutoApproveRequest('sign_event', signEventParams({ kind }))
      ).toBe(true)
    }
  })

  it('requires explicit approval for sensitive sign_event kinds', () => {
    for (const kind of [
      0, // profile metadata
      3, // contact list
      5, // deletion
      10002, // relay list
      10003 // bookmarks
    ]) {
      expect(
        canAutoApproveRequest('sign_event', signEventParams({ kind }))
      ).toBe(false)
    }
  })

  it('requires explicit approval for unknown sign_event kinds', () => {
    expect(
      canAutoApproveRequest('sign_event', signEventParams({ kind: 99999 }))
    ).toBe(false)
  })

  it('requires explicit approval when the event cannot be parsed', () => {
    expect(canAutoApproveRequest('sign_event', ['not-json'])).toBe(false)
    expect(canAutoApproveRequest('sign_event', [])).toBe(false)
  })

  it('auto-approves non-sensitive methods', () => {
    expect(canAutoApproveRequest('ping', [])).toBe(true)
    expect(canAutoApproveRequest('connect', [])).toBe(true)
    expect(canAutoApproveRequest('get_public_key', [])).toBe(true)
    expect(canAutoApproveRequest('nip04_encrypt', ['pk', 'pt'])).toBe(true)
    expect(canAutoApproveRequest('nip44_encrypt', ['pk', 'pt'])).toBe(true)
  })
})

describe('getEventPreview', () => {
  it('returns the full untruncated content and all tags', () => {
    const longContent = 'x'.repeat(5000)
    const tags = [
      ['e', 'abc'],
      ['p', 'def', 'wss://relay.example']
    ]
    const preview = getEventPreview(
      signEventParams({ content: longContent, kind: 1, tags })
    )

    expect(preview).not.toBeNull()
    expect(preview?.content).toBe(longContent)
    expect(preview?.tags).toStrictEqual(tags)
  })

  it('returns null for malformed params', () => {
    expect(getEventPreview(['not-json'])).toBeNull()
  })
})
