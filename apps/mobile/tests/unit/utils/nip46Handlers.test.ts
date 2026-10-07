import { getPublicKey, verifyEvent } from 'nostr-tools'

import { handleSignEvent } from '@/utils/nip46Handlers'

// The repo-wide manual mock at tests/__mocks__/nostr-tools.js stubs out the
// signing this test exercises — use the real module.
jest.unmock('nostr-tools')

const signerSecretKey = new Uint8Array(32).fill(7)

const template = {
  content: 'hello',
  created_at: 1700000000,
  kind: 1,
  tags: [['t', 'satsigner']]
}

describe('handleSignEvent', () => {
  it('signs the template with the signer key', () => {
    const signed = JSON.parse(
      handleSignEvent(JSON.stringify(template), signerSecretKey)
    )

    expect(signed).toMatchObject(template)
    expect(signed.pubkey).toBe(getPublicKey(signerSecretKey))
    expect(verifyEvent(signed)).toBe(true)
  })

  it('ignores fields outside the event template', () => {
    const signed = JSON.parse(
      handleSignEvent(
        JSON.stringify({ ...template, extra: 'value', pubkey: 'f'.repeat(64) }),
        signerSecretKey
      )
    )

    expect(signed.extra).toBeUndefined()
    expect(signed.pubkey).toBe(getPublicKey(signerSecretKey))
  })

  it('rejects malformed templates', () => {
    expect(() =>
      handleSignEvent(
        JSON.stringify({ ...template, tags: [['t', 1]] }),
        signerSecretKey
      )
    ).toThrow('Invalid event template')
    expect(() =>
      handleSignEvent(
        JSON.stringify({ ...template, created_at: undefined }),
        signerSecretKey
      )
    ).toThrow('Invalid event template')
    expect(() => handleSignEvent('not-json', signerSecretKey)).toThrow(
      SyntaxError
    )
  })
})
