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

export function deriveNostrKeysFromMnemonic(
  mnemonic: string
): DerivedNostrKeys {
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
  return { mnemonic, npub, nsec, privateKey }
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
  authorLud16?: string
  authorNip05?: string
}

export type DecodedNostrContent = {
  kind: NostrContentKind
  raw: string
  data: string
  metadata?: Record<string, unknown>
  fetched?: FetchedNoteData
  isLoading?: boolean
}

function stripNostrUri(data: string): string {
  return data.toLowerCase().startsWith('nostr:') ? data.slice(6) : data
}

export function decodeNostrContent(raw: string): DecodedNostrContent {
  const trimmed = stripNostrUri(raw.trim())

  if (trimmed.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(trimmed)
      if (decoded.type === 'npub') {
        return { data: decoded.data as string, kind: 'npub', raw: trimmed }
      }
    } catch {
      /* invalid bech32 */
    }
  }

  if (trimmed.startsWith('note1')) {
    try {
      const decoded = nip19.decode(trimmed)
      if (decoded.type === 'note') {
        return { data: decoded.data as string, kind: 'note', raw: trimmed }
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
          data: neventData.id,
          kind: 'nevent',
          metadata: {
            relays: neventData.relays,
            author: neventData.author
          },
          raw: trimmed
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
          data: profileData.pubkey,
          kind: 'nprofile',
          metadata: { relays: profileData.relays },
          raw: trimmed
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
        data: (parsed.id as string) ?? '',
        kind: 'json_note',
        metadata: parsed,
        raw: trimmed
      }
    }
  } catch {
    /* not JSON */
  }

  return { data: '', kind: 'unknown', raw: trimmed }
}

export type PubpayTag = {
  amount: number
  currency: string
  relay?: string
}

export function extractPubpayTags(tags: string[][]): PubpayTag[] {
  const results: PubpayTag[] = []
  for (const tag of tags) {
    if (tag[0] === 'amount') {
      const msats = parseInt(tag[1], 10)
      if (!isNaN(msats)) {
        results.push({
          amount: Math.floor(msats / 1000),
          currency: 'sats',
          relay: tag[2]
        })
      }
    }
  }
  return results
}

export type EnhancedZapTags = {
  zapMin?: number
  zapMax?: number
  zapGoal?: number
  zapUses?: number
  zapPayer?: string
  zapLnurl?: string
}

function parseMsatsTag(tags: string[][], name: string): number | undefined {
  const tag = tags.find((t) => t[0] === name)
  if (!tag || !tag[1]) {return undefined}
  const val = parseInt(tag[1], 10)
  return isNaN(val) || val <= 0 ? undefined : Math.floor(val / 1000)
}

export function extractEnhancedZapTags(tags: string[][]): EnhancedZapTags {
  const zapGoalRaw = tags.find((t) => t[0] === 'zap-goal')
  const zapUsesRaw = tags.find((t) => t[0] === 'zap-uses')
  const zapPayerRaw = tags.find((t) => t[0] === 'zap-payer')
  const zapLnurlRaw = tags.find((t) => t[0] === 'zap-lnurl')

  const result: EnhancedZapTags = {
    zapMax: parseMsatsTag(tags, 'zap-max'),
    zapMin: parseMsatsTag(tags, 'zap-min')
  }

  if (zapGoalRaw?.[1]) {
    const val = parseInt(zapGoalRaw[1], 10)
    if (!isNaN(val) && val > 0) {result.zapGoal = Math.floor(val / 1000)}
  }
  if (zapUsesRaw?.[1]) {
    const val = parseInt(zapUsesRaw[1], 10)
    if (!isNaN(val) && val > 0) {result.zapUses = val}
  }
  if (zapPayerRaw?.[1] && /^[a-f0-9]{64}$/i.test(zapPayerRaw[1])) {
    result.zapPayer = zapPayerRaw[1]
  }
  if (zapLnurlRaw?.[1] && zapLnurlRaw[1].includes('@')) {
    result.zapLnurl = zapLnurlRaw[1]
  }

  return result
}

export function buildEnhancedZapTags(config: EnhancedZapTags): string[][] {
  const tags: string[][] = []
  if (config.zapMin !== undefined && config.zapMin > 0) {
    tags.push(['zap-min', String(config.zapMin * 1000)])
  }
  if (config.zapMax !== undefined && config.zapMax > 0) {
    tags.push(['zap-max', String(config.zapMax * 1000)])
  }
  if (config.zapGoal !== undefined && config.zapGoal > 0) {
    tags.push(['zap-goal', String(config.zapGoal * 1000)])
  }
  if (config.zapUses !== undefined && config.zapUses > 0) {
    tags.push(['zap-uses', String(config.zapUses)])
  }
  if (config.zapPayer) {
    tags.push(['zap-payer', config.zapPayer])
  }
  if (config.zapLnurl) {
    tags.push(['zap-lnurl', config.zapLnurl])
  }
  return tags
}

export function npubFromNsec(nsec: string): string | null {
  return deriveNpubFromNsec(nsec)
}

export function truncateNpub(npub: string, chars = 8): string {
  if (npub.length <= chars * 2 + 3) {return npub}
  return `${npub.slice(0, chars)}...${npub.slice(-chars)}`
}
