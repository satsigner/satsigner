import {
  compressMessage,
  decompressMessage,
  deriveNostrKeysFromDescriptor,
  generateColorFromNpub,
  parseNostrTransactionMessage
} from '@/utils/nostr'

jest.mock('nostr-tools')
jest.mock('react-native-aes-crypto')

describe('parseNostrTransactionMessage', () => {
  const validPsbt =
    'cHNidP8BAHUCAAAAASaBcTce3/KF6Tet7qSze3gADAVmy7OtZGQXE8pCFxv2AAAAAAD+////AtPf9QUAAAAAGXapFNDFmQPFusKGh2DpD9UhpGZap2UgiKwA4fUFAAAAABepFDVF5uM7gyxHBQ8k0fzGILd13A=='

  it('returns TransactionData for PSBT messages', () => {
    const result = parseNostrTransactionMessage(validPsbt)
    expect(result).not.toBeNull()
    expect(result?.combinedPsbt).toBe(validPsbt)
  })

  it('handles whitespace trimming', () => {
    const result = parseNostrTransactionMessage(`   ${validPsbt}   `)
    expect(result?.combinedPsbt).toBe(validPsbt)
  })

  it('returns null for non-PSBT messages', () => {
    const invalidMessages = [
      'Hello, this is a regular message',
      '',
      '   ',
      `Here is a PSBT: ${validPsbt}`
    ]
    for (const message of invalidMessages) {
      expect(parseNostrTransactionMessage(message)).toBeNull()
    }
  })
})

describe('compressMessage and decompressMessage', () => {
  const testCases = [
    { name: 'string', data: 'Hello, World!' },
    { name: 'object', data: { name: 'Test', value: 123, active: true } },
    { name: 'array', data: [1, 2, 3, 'four', { five: 5 }] },
    {
      name: 'nested data',
      data: {
        level1: { level2: { data: 'deep', array: [1, { nested: true }] } },
        list: [{ id: 1 }, { id: 2 }]
      }
    }
  ]

  for (const { name, data } of testCases) {
    it(`roundtrips ${name}`, () => {
      const compressed = compressMessage(data)
      const decompressed = decompressMessage(compressed)
      expect(decompressed).toEqual(data)
    })
  }

  it('throws on invalid compressed data', () => {
    expect(() => decompressMessage('invalid-data')).toThrow()
  })

  it('compresses large data', () => {
    const largeData = {
      data: 'a'.repeat(1000),
      numbers: Array.from({ length: 100 }, (_, i) => i)
    }
    const compressed = compressMessage(largeData)
    expect(compressed.length).toBeLessThan(JSON.stringify(largeData).length)
  })
})

describe('generateColorFromNpub', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws for invalid npub', async () => {
    const { nip19 } = require('nostr-tools')
    nip19.decode.mockImplementation(() => {
      throw new Error('Invalid bech32')
    })
    await expect(generateColorFromNpub('invalid')).rejects.toThrow()
  })

  it('returns valid hex color for valid npub', async () => {
    const { nip19 } = require('nostr-tools')
    nip19.decode.mockReturnValue({ type: 'npub', data: 'abc123' })
    const color = await generateColorFromNpub('npub1abc123')
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('returns deterministic color for same npub', async () => {
    const { nip19 } = require('nostr-tools')
    nip19.decode.mockReturnValue({ type: 'npub', data: 'abc123' })
    const npub = 'npub1abc123'
    expect(await generateColorFromNpub(npub)).toBe(
      await generateColorFromNpub(npub)
    )
  })

  it('returns different colors for different npubs', async () => {
    const { nip19 } = require('nostr-tools')
    nip19.decode.mockReturnValue({ type: 'npub', data: 'abc123' })
    const color1 = await generateColorFromNpub('npub1abc123')
    const color2 = await generateColorFromNpub('npub1xyz789')
    expect(color1).not.toBe(color2)
  })

  it('returns default color for wrong type', async () => {
    const { nip19 } = require('nostr-tools')
    nip19.decode.mockReturnValue({ type: 'nsec', data: 'abc123' })
    const color = await generateColorFromNpub('nsec1abc123')
    expect(color).toBe('#404040')
  })
})

describe('deriveNostrKeysFromDescriptor', () => {
  const testDescriptor =
    "wpkh([a1b2c3d4/84'/0'/0']tpubDCo2K1HzLmqvQPdmGV8FUVePqBTqLx9VTD9h1MvSmWzQNArnqFqSU6LjUTYPNjXWB7h7qHvBXbY6m3bgKBawX7cAzuEF7qnbqxSiT2Xu4Y/0/*)#checksum"

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns valid nsec and npub', async () => {
    const result = await deriveNostrKeysFromDescriptor(testDescriptor)
    expect(result.commonNsec).toMatch(/^nsec1/)
    expect(result.commonNpub).toMatch(/^npub1/)
  })

  it('returns 32-byte privateKeyBytes', async () => {
    const result = await deriveNostrKeysFromDescriptor(testDescriptor)
    expect(result.privateKeyBytes).toBeInstanceOf(Uint8Array)
    expect(result.privateKeyBytes.length).toBe(32)
  })

  it('produces deterministic keys for same descriptor', async () => {
    const result1 = await deriveNostrKeysFromDescriptor(testDescriptor)
    const result2 = await deriveNostrKeysFromDescriptor(testDescriptor)
    expect(result1.commonNsec).toBe(result2.commonNsec)
    expect(result1.commonNpub).toBe(result2.commonNpub)
  })

  it('produces different keys for different descriptors', async () => {
    const otherDescriptor =
      "wpkh([b2c3d4e5/84'/0'/0']tpubDDifferent/0/*)#checksum"
    const result1 = await deriveNostrKeysFromDescriptor(testDescriptor)
    const result2 = await deriveNostrKeysFromDescriptor(otherDescriptor)
    expect(result1.commonNsec).not.toBe(result2.commonNsec)
  })
})
