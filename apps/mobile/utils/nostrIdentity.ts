import { HDKey } from '@scure/bip32'
import { getPublicKey, nip19 } from 'nostr-tools'

import { mnemonicToSeed } from '@/utils/bip39'
import { deriveNpubFromNsec } from '@/utils/nostr'

const NIP06_DERIVATION_PATH = "m/44'/1237'/0'/0/0"

type DerivedNostrKeys = {
  nsec: string
  npub: string
  privateKey: Uint8Array
  mnemonic: string
}

export function deriveNostrKeysFromMnemonic(mnemonic: string): DerivedNostrKeys {
  const seed = mnemonicToSeed(mnemonic)
  const root = HDKey.fromMasterSeed(seed)
  const child = root.derive(NIP06_DERIVATION_PATH)
  if (!child.privateKey) {
    throw new Error('Failed to derive private key from mnemonic')
  }
  const privateKey = new Uint8Array(child.privateKey)
  const publicKey = getPublicKey(privateKey)
  const nsec = nip19.nsecEncode(privateKey)
  const npub = nip19.npubEncode(publicKey)
  return { nsec, npub, privateKey, mnemonic }
}

export type NostrContentKind =
  | 'npub'
  | 'note'
  | 'nevent'
  | 'nprofile'
  | 'json_note'
  | 'unknown'

export type FetchedNoteData = {
  content: string
  pubkey: string
  kind: number
  tags: string[][]
  created_at: number
  authorName?: string
  authorPicture?: string
}

export type DecodedNostrContent = {
  kind: NostrContentKind
  raw: string
  data: string
  metadata?: Record<string, unknown>
  fetched?: FetchedNoteData
  isLoading?: boolean
}

export function decodeNostrContent(raw: string): DecodedNostrContent {
  const trimmed = raw.trim()

  if (trimmed.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(trimmed)
      if (decoded.type === 'npub') {
        return { kind: 'npub', raw: trimmed, data: decoded.data as string }
      }
    } catch {
      /* invalid bech32 */
    }
  }

  if (trimmed.startsWith('note1')) {
    try {
      const decoded = nip19.decode(trimmed)
      if (decoded.type === 'note') {
        return { kind: 'note', raw: trimmed, data: decoded.data as string }
      }
    } catch {
      /* invalid bech32 */
    }
  }

  if (trimmed.startsWith('nevent1')) {
    try {
      const decoded = nip19.decode(trimmed)
      if (decoded.type === 'nevent') {
        const neventData = decoded.data as {
          id: string
          relays?: string[]
          author?: string
        }
        return {
          kind: 'nevent',
          raw: trimmed,
          data: neventData.id,
          metadata: {
            relays: neventData.relays,
            author: neventData.author
          }
        }
      }
    } catch {
      /* invalid bech32 */
    }
  }

  if (trimmed.startsWith('nprofile1')) {
    try {
      const decoded = nip19.decode(trimmed)
      if (decoded.type === 'nprofile') {
        const profileData = decoded.data as {
          pubkey: string
          relays?: string[]
        }
        return {
          kind: 'nprofile',
          raw: trimmed,
          data: profileData.pubkey,
          metadata: { relays: profileData.relays }
        }
      }
    } catch {
      /* invalid bech32 */
    }
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    if (
      typeof parsed.kind === 'number' &&
      typeof parsed.content === 'string' &&
      Array.isArray(parsed.tags)
    ) {
      return {
        kind: 'json_note',
        raw: trimmed,
        data: (parsed.id as string) ?? '',
        metadata: parsed
      }
    }
  } catch {
    /* not JSON */
  }

  return { kind: 'unknown', raw: trimmed, data: '' }
}

export type PubpayTag = {
  amount: number
  currency: string
  relay?: string
}

export function extractPubpayTags(
  tags: string[][]
): PubpayTag[] {
  return tags
    .filter((tag) => tag[0] === 'amount' || tag[0] === 'zap')
    .map((tag) => {
      if (tag[0] === 'amount') {
        const msats = parseInt(tag[1], 10)
        if (isNaN(msats)) return null
        return {
          amount: Math.floor(msats / 1000),
          currency: 'sats',
          relay: tag[2]
        }
      }
      return null
    })
    .filter((t): t is PubpayTag => t !== null)
}

export function npubFromNsec(nsec: string): string | null {
  return deriveNpubFromNsec(nsec)
}

export function truncateNpub(npub: string, chars = 8): string {
  if (npub.length <= chars * 2 + 3) return npub
  return `${npub.slice(0, chars)}...${npub.slice(-chars)}`
}
