import { contactToIdentity, mergeProfileBatch } from '@/utils/nostrContacts'

jest.mock<typeof import('nostr-tools')>('nostr-tools', () => ({
  nip19: {
    npubEncode: (hex: string) => `npub1mock${hex.slice(0, 8)}`
  }
}))

describe('contactToIdentity', () => {
  it('maps contact profile fields to NostrIdentity', () => {
    const hex = 'a'.repeat(64)
    const identity = contactToIdentity({
      profile: {
        displayName: 'Alice',
        lud16: 'alice@wallet.com',
        nip05: 'alice@example.com',
        picture: 'https://example.com/alice.jpg'
      },
      pubkey: hex
    })

    expect(identity.displayName).toBe('Alice')
    expect(identity.lud16).toBe('alice@wallet.com')
    expect(identity.nip05).toBe('alice@example.com')
    expect(identity.picture).toBe('https://example.com/alice.jpg')
    expect(identity.isWatchOnly).toBe(false)
    expect(identity.npub).toBe(`npub1mock${hex.slice(0, 8)}`)
  })

  it('handles missing profile', () => {
    const hex = 'b'.repeat(64)
    const identity = contactToIdentity({ profile: null, pubkey: hex })

    expect(identity.displayName).toBeUndefined()
    expect(identity.npub).toBe(`npub1mock${hex.slice(0, 8)}`)
  })
})

describe('mergeProfileBatch', () => {
  it('merges profile data for matching pubkeys only', () => {
    const pk1 = 'a'.repeat(64)
    const pk2 = 'b'.repeat(64)
    const contacts = [
      { profile: null, pubkey: pk1 },
      { profile: null, pubkey: pk2 }
    ]
    const batch = new Map([
      [pk1, { displayName: 'Alice', nip05: 'alice@example.com' }]
    ])

    const merged = mergeProfileBatch(contacts, batch)

    expect(merged[0].profile?.displayName).toBe('Alice')
    expect(merged[1].profile).toBeNull()
  })
})
