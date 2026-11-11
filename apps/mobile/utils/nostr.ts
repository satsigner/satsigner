import ecc from '@bitcoinerlab/secp256k1'
import { bytesToHex } from '@noble/hashes/utils'
import * as bitcoinjs from 'bitcoinjs-lib'
import CBOR from 'cbor-js'
import { getPublicKey, nip05 as nostrNip05, nip19 } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'
import pako from 'pako'

import { PSBT_MAGIC_BASE64 } from '@/constants/btc'
import { NOSTR_FALLBACK_NPUB_COLOR } from '@/constants/nostr'
import { type NostrKind0Profile } from '@/types/models/Nostr'
import { base85Decode, base85Encode } from '@/utils/base58'
import { sha256 } from '@/utils/crypto'
import { isRecord } from '@/utils/object'
import { parseDescriptor } from '@/utils/parse'
import { type TransactionData } from '@/utils/psbt'

bitcoinjs.initEccLib(ecc)

export function getNip19Type(value: string): string | null {
  try {
    return nip19.decode(value).type
  } catch {
    return null
  }
}

export function generateColorFromNpub(npub: string): string {
  if (getNip19Type(npub) !== 'npub') {
    return NOSTR_FALLBACK_NPUB_COLOR
  }
  const pubkey = npub

  // Generate color from hash - match Python's hashlib.sha256() output
  const hash = Buffer.from(
    bitcoinjs.crypto.sha256(Buffer.from(pubkey))
  ).toString('hex')
  const seed = BigInt(`0x${hash}`)
  const hue = Number(seed % 360n) // Map to a hue value between 0-359

  const saturation = 255 // High saturation for vividness
  const lightness = 180 // Dark mode value (180/255 * 100 ≈ 70%)

  // QColor's HSL to RGB conversion algorithm
  const h = hue / 60
  const s = saturation / 255
  const l = lightness / 255

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h % 2) - 1))
  const m = l - c / 2

  const [r, g, b] =
    h < 1
      ? [c, x, 0]
      : h < 2
        ? [x, c, 0]
        : h < 3
          ? [0, c, x]
          : h < 4
            ? [0, x, c]
            : h < 5
              ? [x, 0, c]
              : [c, 0, x]

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16)
    return hex.length === 1 ? `0${hex}` : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function deriveNpubFromNsec(nsec: string): string | null {
  if (!nsec?.trim()) {
    return null
  }
  try {
    const decoded = nip19.decode(nsec.trim())
    if (!decoded || decoded.type !== 'nsec') {
      return null
    }
    const publicKey = getPublicKey(decoded.data)
    return nip19.npubEncode(publicKey)
  } catch {
    return null
  }
}

/** npubEncode a hex pubkey, returning `fallback` (the hex itself by default) when encoding fails. */
export function safeNpubEncode(hex: string, fallback = hex): string {
  try {
    return nip19.npubEncode(hex)
  } catch {
    return fallback
  }
}

export function getPubKeyHexFromNpub(npub: string): string | null {
  try {
    const decoded = nip19.decode(npub)
    if (!decoded || decoded.type !== 'npub' || !decoded.data) {
      return null
    }
    const hex = decoded.data.toLowerCase().replace(/^0x/, '')
    if (hex.length !== 64 || !/^[0-9a-f]+$/.test(hex)) {
      return null
    }
    return hex
  } catch {
    return null
  }
}

export function getSecretFromNsec(nsec: string): Uint8Array | null {
  try {
    const decoded = nip19.decode(nsec)
    if (!decoded || decoded.type !== 'nsec' || !decoded.data) {
      return null
    }
    return decoded.data
  } catch {
    return null
  }
}

export type NostrKeyFormat = 'bech32' | 'hex'

export function formatNostrKey(
  key: string,
  format: NostrKeyFormat
): string | null {
  const trimmed = key.trim()
  const type = getNip19Type(trimmed)
  if (type !== 'npub' && type !== 'nsec') {
    return null
  }
  if (format === 'bech32') {
    return trimmed
  }
  if (type === 'npub') {
    return getPubKeyHexFromNpub(trimmed)
  }
  const secret = getSecretFromNsec(trimmed)
  return secret ? bytesToHex(secret) : null
}

export function parseNostrTransaction(message: string): TransactionData | null {
  return parseNostrTransactionMessage(message)
}

function parseNostrTransactionMessage(message: string): TransactionData | null {
  if (message.trim().startsWith(PSBT_MAGIC_BASE64)) {
    const transactionData: TransactionData = {
      combinedPsbt: message.trim()
    }
    return transactionData
  }
  return null
}

export function compressMessage(data: object): string {
  const cborData = CBOR.encode(data)
  const jsonUint8 = new Uint8Array(cborData)
  const compressedData = pako.deflate(jsonUint8)
  const compressedBuffer = Buffer.from(compressedData)
  return base85Encode(compressedBuffer)
}

export function decompressMessage(compressedString: string): unknown {
  const compressedBytes = base85Decode(compressedString)
  const cborBytes = pako.inflate(new Uint8Array(compressedBytes))
  const bufferSlice = cborBytes.buffer.slice(
    cborBytes.byteOffset,
    cborBytes.byteOffset + cborBytes.byteLength
  )
  return CBOR.decode(bufferSlice)
}

export async function deriveNostrKeysFromDescriptor(
  externalDescriptor: string
): Promise<{
  commonNsec: string
  commonNpub: string
  privateKeyBytes: Uint8Array
}> {
  const { hardenedPath, xpubs } = parseDescriptor(externalDescriptor)
  const totalString = `${hardenedPath}${xpubs.join('')}`
  const firstHash = await sha256(totalString)
  const doubleHash = await sha256(firstHash)
  const privateKeyBytes = new Uint8Array(Buffer.from(doubleHash, 'hex'))
  const publicKey = getPublicKey(privateKeyBytes)
  const commonNsec = nip19.nsecEncode(privateKeyBytes)
  const commonNpub = nip19.npubEncode(publicKey)
  return { commonNpub, commonNsec, privateKeyBytes }
}

export function validateNip05(
  pubkeyHex: string,
  nip05Address: string
): Promise<boolean> {
  if (!nostrNip05.isNip05(nip05Address)) {
    return Promise.resolve(false)
  }
  return nostrNip05.isValid(pubkeyHex, nip05Address).catch(() => false)
}

/**
 * Extracts DM inbox relay urls from relay-list events. Newest kind 10050
 * (NIP-17, `relay` tags) wins; falls back to newest kind 10002 (NIP-65,
 * `r` tags). wss-only, deduped, empty when neither kind is present.
 */
export function extractInboxRelayUrls(
  events: { created_at?: number; kind?: number; tags: string[][] }[]
): string[] {
  const sorted = [...events].toSorted(
    (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
  )
  const dmInbox = sorted.find(
    (e) => e.kind === nostrKinds.DirectMessageRelaysList
  )
  const relayList = sorted.find((e) => e.kind === nostrKinds.RelayList)
  const pick = dmInbox ?? relayList
  if (!pick) {
    return []
  }
  const tagName =
    pick.kind === nostrKinds.DirectMessageRelaysList ? 'relay' : 'r'
  const urls = pick.tags
    .filter((tag) => tag[0] === tagName && typeof tag[1] === 'string')
    .map((tag) => tag[1])
    .filter((url) => url.startsWith('wss://'))
  return [...new Set(urls)]
}

/** Kind 0 content as a JSON object; null when it is not one. */
export function parseKind0Object(
  contentJson: string
): Record<string, unknown> | null {
  try {
    const content: unknown = JSON.parse(contentJson)
    return isRecord(content) ? content : null
  } catch {
    return null
  }
}

function parseKind0Record(contentJson: string): Record<string, unknown> {
  return parseKind0Object(contentJson) ?? {}
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

const KIND0_KEYS_BY_FIELD: Record<keyof NostrKind0Profile, string[]> = {
  banner: ['banner'],
  displayName: ['name', 'display_name'],
  lud16: ['lud16'],
  nip05: ['nip05'],
  picture: ['picture']
}

// Keys read as a fallback only, never written; clearing the field drops them.
const KIND0_FALLBACK_KEYS_BY_FIELD: Partial<
  Record<keyof NostrKind0Profile, string[]>
> = {
  displayName: ['username']
}

const KIND0_PROFILE_FIELDS: (keyof NostrKind0Profile)[] = [
  'banner',
  'displayName',
  'lud16',
  'nip05',
  'picture'
]

/** Profile fields whose value differs; cleared fields map to undefined. */
export function getChangedProfileFields(
  before: NostrKind0Profile,
  after: NostrKind0Profile
): Partial<NostrKind0Profile> {
  const changed: Partial<NostrKind0Profile> = {}
  for (const field of KIND0_PROFILE_FIELDS) {
    const value = after[field] || undefined
    if (value !== (before[field] || undefined)) {
      changed[field] = value
    }
  }
  return changed
}

/**
 * Kind 0 content with only the changed fields written over the latest
 * published content, so fields edited elsewhere or unknown to this app
 * (about, website, …) survive.
 */
export function buildKind0Content(
  latestContentJson: string | undefined,
  changes: Partial<NostrKind0Profile>
): string {
  const content = latestContentJson ? parseKind0Record(latestContentJson) : {}
  const changedFields = KIND0_PROFILE_FIELDS.filter((field) => field in changes)
  for (const field of changedFields) {
    applyKind0Field(content, field, changes[field])
  }
  return JSON.stringify(content)
}

function applyKind0Field(
  content: Record<string, unknown>,
  field: keyof NostrKind0Profile,
  value: string | undefined
) {
  if (value) {
    for (const key of KIND0_KEYS_BY_FIELD[field]) {
      content[key] = value
    }
    return
  }
  const fallbackKeys = KIND0_FALLBACK_KEYS_BY_FIELD[field] ?? []
  for (const key of [...KIND0_KEYS_BY_FIELD[field], ...fallbackKeys]) {
    delete content[key]
  }
}

/** Parses kind 0 content JSON into a profile; null when nothing usable. */
export function getProfileFromKind0Content(
  contentJson: string
): NostrKind0Profile | null {
  const content = parseKind0Record(contentJson)
  const displayName =
    optionalString(content.name) ??
    optionalString(content.display_name) ??
    optionalString(content.username)
  const picture = optionalString(content.picture)
  const banner = optionalString(content.banner)
  const nip05 = optionalString(content.nip05)
  const lud16 = optionalString(content.lud16)
  if (!displayName && !picture && !banner && !nip05 && !lud16) {
    return null
  }
  return { banner, displayName, lud16, nip05, picture }
}
