import { HDKey } from '@scure/bip32'

/**
 * NIP-06 derivation test vectors.
 *
 * We replicate the derivation path m/44'/1237'/0'/0/0 using @scure/bip32
 * and react-native-bdk-sdk (mocked) for mnemonicToSeed. The private key hex
 * is verified against the expected npub bech32 by decoding the npub with the
 * real bech32 algorithm (manual Bech32 decode below).
 *
 * This avoids depending on the nostr-tools mock which returns fake bech32.
 */

jest.mock('nostr-tools')

const NIP06_PATH = "m/44'/1237'/0'/0/0"

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

function bech32Decode(bech: string): { hrp: string; data: number[] } {
  const pos = bech.lastIndexOf('1')
  const hrp = bech.slice(0, pos)
  const dataChars = bech.slice(pos + 1)
  const data: number[] = []
  for (const c of dataChars) {
    data.push(BECH32_CHARSET.indexOf(c))
  }
  const payload = data.slice(0, -6)
  return { hrp, data: payload }
}

function convertBits(
  data: number[],
  fromBits: number,
  toBits: number,
  pad: boolean
): number[] {
  let acc = 0
  let bits = 0
  const ret: number[] = []
  const maxv = (1 << toBits) - 1
  for (const value of data) {
    acc = (acc << fromBits) | value
    bits += fromBits
    while (bits >= toBits) {
      bits -= toBits
      ret.push((acc >> bits) & maxv)
    }
  }
  if (pad && bits > 0) {
    ret.push((acc << (toBits - bits)) & maxv)
  }
  return ret
}

function npubToHex(npub: string): string {
  const { data } = bech32Decode(npub)
  const bytes = convertBits(data, 5, 8, false)
  return Buffer.from(bytes).toString('hex')
}

describe('NIP-06 derivation from mnemonic', () => {
  it('derives the correct private key hex from test mnemonic via BIP-32 path', () => {
    const mnemonic =
      'antenna shoot slogan swear payment bless walk raven charge often wheat rhythm'

    const { Mnemonic } = require('react-native-bdk-sdk')
    const m = Mnemonic.fromString(mnemonic)
    const seedHex = m.toSeedHex('')
    const seed = new Uint8Array(Buffer.from(seedHex, 'hex'))

    const root = HDKey.fromMasterSeed(seed)
    const child = root.derive(NIP06_PATH)
    expect(child.privateKey).toBeDefined()
    expect(child.privateKey!.length).toBe(32)

    const privateKeyHex = Buffer.from(child.privateKey!).toString('hex')
    expect(privateKeyHex.length).toBe(64)
  })

  it('derives npub matching the expected test vector', () => {
    const expectedNpub =
      'npub15hevlljyxfquzjdafqfl7z4r9n5h8plz634h3v20m7cgj4hvwquq3wns4z'
    const expectedPubkeyHex = npubToHex(expectedNpub)

    const mnemonic =
      'antenna shoot slogan swear payment bless walk raven charge often wheat rhythm'

    const { Mnemonic } = require('react-native-bdk-sdk')
    const m = Mnemonic.fromString(mnemonic)
    const seedHex = m.toSeedHex('')
    const seed = new Uint8Array(Buffer.from(seedHex, 'hex'))

    const root = HDKey.fromMasterSeed(seed)
    const child = root.derive(NIP06_PATH)
    const privateKey = new Uint8Array(child.privateKey!)

    // Compute public key using secp256k1
    // @scure/bip32 exposes the public key on the derived key
    const publicKeyBytes = child.publicKey
    expect(publicKeyBytes).toBeDefined()

    // BIP-32 public keys are 33-byte compressed (02/03 prefix).
    // Nostr uses the 32-byte x-coordinate (schnorr/xonly).
    const xOnlyPubkey = publicKeyBytes!.slice(1)
    const derivedPubkeyHex = Buffer.from(xOnlyPubkey).toString('hex')

    expect(derivedPubkeyHex).toBe(expectedPubkeyHex)
  })
})

describe('decodeNostrContent', () => {
  it('detects npub strings', () => {
    const { decodeNostrContent } = require('@/utils/nostrIdentity')
    const result = decodeNostrContent(
      'npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg'
    )
    expect(result.kind).toBe('npub')
  })

  it('returns unknown for garbage input', () => {
    const { decodeNostrContent } = require('@/utils/nostrIdentity')
    const result = decodeNostrContent('not-a-nostr-entity')
    expect(result.kind).toBe('unknown')
  })

  it('detects JSON note objects', () => {
    const { decodeNostrContent } = require('@/utils/nostrIdentity')
    const jsonNote = JSON.stringify({
      id: 'abc123',
      kind: 1,
      content: 'hello world',
      tags: []
    })
    const result = decodeNostrContent(jsonNote)
    expect(result.kind).toBe('json_note')
  })
})

describe('extractPubpayTags', () => {
  it('extracts amount tags in millisats and converts to sats', () => {
    const { extractPubpayTags } = require('@/utils/nostrIdentity')
    const tags = [
      ['amount', '21000'],
      ['p', 'deadbeef']
    ]
    const result = extractPubpayTags(tags)
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(21)
    expect(result[0].currency).toBe('sats')
  })

  it('returns empty array when no payment tags exist', () => {
    const { extractPubpayTags } = require('@/utils/nostrIdentity')
    const tags = [
      ['e', 'eventid'],
      ['p', 'pubkey']
    ]
    expect(extractPubpayTags(tags)).toHaveLength(0)
  })
})

describe('truncateNpub', () => {
  it('truncates long npubs with ellipsis', () => {
    const { truncateNpub } = require('@/utils/nostrIdentity')
    const npub =
      'npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg'
    const result = truncateNpub(npub)
    expect(result).toBe('npub10el...8qzvjptg')
    expect(result.length).toBeLessThan(npub.length)
  })
})
