import {
  compressMessage,
  decompressMessage,
  deriveNostrKeysFromDescriptor,
  generateColorFromNpub,
  parseNostrTransactionMessage
} from '@/utils/nostr'

import { descriptors, nostrKeys, nostrMessages, psbts } from './nostr_samples'

jest.mock('nostr-tools')
jest.mock('react-native-aes-crypto')

describe('parseNostrTransactionMessage', () => {
  it('returns TransactionData for valid PSBT', () => {
    const result = parseNostrTransactionMessage(psbts.simple)
    expect(result).not.toBeNull()
    expect(result?.combinedPsbt).toBe(psbts.simple)
  })

  it('handles PSBT with whitespace', () => {
    const result = parseNostrTransactionMessage(psbts.withWhitespace)
    expect(result).not.toBeNull()
    expect(result?.combinedPsbt).toBe(psbts.withWhitespace.trim())
  })

  it('handles PSBT with newlines', () => {
    const result = parseNostrTransactionMessage(psbts.withNewlines)
    expect(result).not.toBeNull()
    expect(result?.combinedPsbt).toBe(psbts.withNewlines.trim())
  })

  it('returns null for non-PSBT messages', () => {
    const invalidInputs = [
      'Hello, this is a regular message',
      '',
      '   ',
      `Here is a PSBT: ${psbts.simple}`,
      nostrKeys.alice.npub,
      'bitcoin:bc1qtest?amount=0.001'
    ]
    for (const input of invalidInputs) {
      expect(parseNostrTransactionMessage(input)).toBeNull()
    }
  })
})

describe('compressMessage and decompressMessage', () => {
  it('roundtrips simple string', () => {
    const original = 'Hello, World!'
    expect(decompressMessage(compressMessage(original))).toBe(original)
  })

  it('roundtrips label sync message', () => {
    const original = nostrMessages.labelSync
    expect(decompressMessage(compressMessage(original))).toEqual(original)
  })

  it('roundtrips PSBT share message', () => {
    const original = nostrMessages.psbtShare
    expect(decompressMessage(compressMessage(original))).toEqual(original)
  })

  it('roundtrips device announcement', () => {
    const original = nostrMessages.deviceAnnouncement
    expect(decompressMessage(compressMessage(original))).toEqual(original)
  })

  it('roundtrips nested data structures', () => {
    const original = {
      messages: [nostrMessages.labelSync, nostrMessages.psbtShare],
      metadata: { version: 1, timestamp: 1704067200 }
    }
    expect(decompressMessage(compressMessage(original))).toEqual(original)
  })

  it('throws on invalid compressed data', () => {
    expect(() => decompressMessage('invalid-data')).toThrow()
    expect(() => decompressMessage(nostrKeys.invalid.notBech32)).toThrow()
  })

  it('compresses large payloads effectively', () => {
    const largePayload = {
      labels: Array.from({ length: 100 }, (_, i) => ({
        type: 'tx',
        ref: `txid${i.toString().padStart(64, '0')}`,
        label: `Transaction ${i}`
      }))
    }
    const compressed = compressMessage(largePayload)
    expect(compressed.length).toBeLessThan(JSON.stringify(largePayload).length)
    expect(decompressMessage(compressed)).toEqual(largePayload)
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
    await expect(
      generateColorFromNpub(nostrKeys.invalid.npub)
    ).rejects.toThrow()
    await expect(
      generateColorFromNpub(nostrKeys.invalid.notBech32)
    ).rejects.toThrow()
  })

  it('returns valid hex color for valid npub', async () => {
    const { nip19 } = require('nostr-tools')
    nip19.decode.mockReturnValue({ type: 'npub', data: 'validpubkey' })
    const color = await generateColorFromNpub(nostrKeys.alice.npub)
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('returns deterministic color for same npub', async () => {
    const { nip19 } = require('nostr-tools')
    nip19.decode.mockReturnValue({ type: 'npub', data: 'validpubkey' })
    const color1 = await generateColorFromNpub(nostrKeys.alice.npub)
    const color2 = await generateColorFromNpub(nostrKeys.alice.npub)
    expect(color1).toBe(color2)
  })

  it('returns different colors for different npubs', async () => {
    const { nip19 } = require('nostr-tools')
    nip19.decode.mockReturnValue({ type: 'npub', data: 'validpubkey' })
    const colorAlice = await generateColorFromNpub(nostrKeys.alice.npub)
    const colorBob = await generateColorFromNpub(nostrKeys.bob.npub)
    expect(colorAlice).not.toBe(colorBob)
  })

  it('returns default color for wrong type', async () => {
    const { nip19 } = require('nostr-tools')
    nip19.decode.mockReturnValue({ type: 'nsec', data: 'secretkey' })
    const color = await generateColorFromNpub(nostrKeys.alice.nsec)
    expect(color).toBe('#404040')
  })
})

describe('deriveNostrKeysFromDescriptor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('derives valid keys from singlesig descriptor', async () => {
    const result = await deriveNostrKeysFromDescriptor(
      descriptors.singlesig.external
    )
    expect(result.commonNsec).toMatch(/^nsec1/)
    expect(result.commonNpub).toMatch(/^npub1/)
    expect(result.privateKeyBytes).toBeInstanceOf(Uint8Array)
    expect(result.privateKeyBytes.length).toBe(32)
  })

  it('derives valid keys from multisig descriptor', async () => {
    const result = await deriveNostrKeysFromDescriptor(
      descriptors.multisig.external
    )
    expect(result.commonNsec).toMatch(/^nsec1/)
    expect(result.commonNpub).toMatch(/^npub1/)
    expect(result.privateKeyBytes.length).toBe(32)
  })

  it('derives valid keys from mainnet descriptor', async () => {
    const result = await deriveNostrKeysFromDescriptor(
      descriptors.mainnet.external
    )
    expect(result.commonNsec).toMatch(/^nsec1/)
    expect(result.commonNpub).toMatch(/^npub1/)
  })

  it('produces deterministic keys for same descriptor', async () => {
    const result1 = await deriveNostrKeysFromDescriptor(
      descriptors.singlesig.external
    )
    const result2 = await deriveNostrKeysFromDescriptor(
      descriptors.singlesig.external
    )
    expect(result1.commonNsec).toBe(result2.commonNsec)
    expect(result1.commonNpub).toBe(result2.commonNpub)
    expect(Array.from(result1.privateKeyBytes)).toEqual(
      Array.from(result2.privateKeyBytes)
    )
  })

  it('produces different keys for different descriptors', async () => {
    const singlesig = await deriveNostrKeysFromDescriptor(
      descriptors.singlesig.external
    )
    const multisig = await deriveNostrKeysFromDescriptor(
      descriptors.multisig.external
    )
    const mainnet = await deriveNostrKeysFromDescriptor(
      descriptors.mainnet.external
    )

    expect(singlesig.commonNsec).not.toBe(multisig.commonNsec)
    expect(singlesig.commonNsec).not.toBe(mainnet.commonNsec)
    expect(multisig.commonNsec).not.toBe(mainnet.commonNsec)
  })

  it('produces same keys for external and internal descriptor of same wallet', async () => {
    // External and internal descriptors share the same hardenedPath and xpubs,
    // only differing in the derivation suffix (/0/* vs /1/*), which is not
    // included in the Nostr key derivation. This is intentional.
    const external = await deriveNostrKeysFromDescriptor(
      descriptors.singlesig.external
    )
    const internal = await deriveNostrKeysFromDescriptor(
      descriptors.singlesig.internal
    )
    expect(external.commonNsec).toBe(internal.commonNsec)
  })
})
