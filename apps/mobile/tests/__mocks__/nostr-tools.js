export const nip19 = {
  decode: jest.fn((str) => {
    if (str.startsWith('npub1')) return { type: 'npub', data: str.slice(5) }
    if (str.startsWith('nsec1'))
      return { type: 'nsec', data: new Uint8Array(32) }
    throw new Error('Invalid bech32')
  }),
  nsecEncode: jest.fn(
    (bytes) => `nsec1${Buffer.from(bytes).toString('hex').slice(0, 58)}`
  ),
  npubEncode: jest.fn(
    (bytes) => `npub1${Buffer.from(bytes).toString('hex').slice(0, 58)}`
  )
}

export const getPublicKey = jest.fn((privKey) => {
  const bytes = new Uint8Array(privKey)
  const reversed = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    reversed[i] = bytes[bytes.length - 1 - i]
  }
  return reversed
})

export const nip17 = {
  wrapEvent: jest.fn(() => ({
    kind: 1059,
    content: 'wrapped-content',
    tags: [],
    created_at: Math.floor(Date.now() / 1000),
    pubkey: 'mock-pubkey'
  }))
}

export const nip59 = {
  unwrapEvent: jest.fn(() => ({
    id: 'mock-event-id',
    content: '{"description": "test message"}',
    created_at: Math.floor(Date.now() / 1000),
    pubkey: 'mock-pubkey',
    kind: 14,
    tags: []
  }))
}
