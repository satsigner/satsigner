import { HDKey } from '@scure/bip32'
import { getPublicKey, nip19 } from 'nostr-tools'

import { SHORT_MNEMONIC_WORD_COUNT } from '@/constants/bip39'
import { MILLISATS_PER_SAT } from '@/constants/btc'
import {
  NOSTR_HASHTAG_TAG,
  NOSTR_NIP06_DERIVATION_PATH,
  NOSTR_PUBPAY_HASHTAG
} from '@/constants/nostr'
import { t } from '@/locales'
import type {
  NostrDecodedContent,
  NostrDerivedKeys,
  NostrEnhancedZapTags,
  NostrRelayConnectionInfo
} from '@/types/models/Nostr'
import { generateMnemonic, mnemonicToSeed } from '@/utils/bip39'
import { deriveNpubFromNsec } from '@/utils/nostr'
import { isRecord } from '@/utils/object'

export function deriveNostrKeysFromMnemonic(
  mnemonic: string
): NostrDerivedKeys {
  const seed = mnemonicToSeed(mnemonic)
  const root = HDKey.fromMasterSeed(seed)
  const child = root.derive(NOSTR_NIP06_DERIVATION_PATH)
  if (!child.privateKey) {
    throw new Error('Failed to derive private key from mnemonic')
  }
  const privateKey = new Uint8Array(child.privateKey)
  const publicKey = getPublicKey(privateKey)
  const nsec = nip19.nsecEncode(privateKey)
  const npub = nip19.npubEncode(publicKey)
  return { mnemonic, npub, nsec, privateKey }
}

/** New personal device keys: BIP39 seed → NIP-06 nsec/npub. */
export function generateDeviceNostrKeysFromSeed(): NostrDerivedKeys {
  const mnemonic = generateMnemonic(SHORT_MNEMONIC_WORD_COUNT)
  return deriveNostrKeysFromMnemonic(mnemonic)
}

function stripNostrUri(data: string): string {
  return data.toLowerCase().startsWith('nostr:') ? data.slice(6) : data
}

export function decodeNostrContent(raw: string): NostrDecodedContent {
  const trimmed = stripNostrUri(raw.trim())

  if (trimmed.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(trimmed)
      if (decoded.type === 'npub') {
        return { data: decoded.data, kind: 'npub', raw: trimmed }
      }
    } catch {
      /* invalid bech32 */
    }
  }

  if (trimmed.startsWith('note1')) {
    try {
      const decoded = nip19.decode(trimmed)
      if (decoded.type === 'note') {
        return { data: decoded.data, kind: 'note', raw: trimmed }
      }
    } catch {
      /* invalid bech32 */
    }
  }

  if (trimmed.startsWith('nevent1')) {
    try {
      const decoded = nip19.decode(trimmed)
      if (decoded.type === 'nevent') {
        return {
          data: decoded.data.id,
          kind: 'nevent',
          metadata: {
            author: decoded.data.author,
            relays: decoded.data.relays
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
        return {
          data: decoded.data.pubkey,
          kind: 'nprofile',
          metadata: { relays: decoded.data.relays },
          raw: trimmed
        }
      }
    } catch {
      /* invalid bech32 */
    }
  }

  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (
      isRecord(parsed) &&
      typeof parsed.kind === 'number' &&
      typeof parsed.content === 'string' &&
      Array.isArray(parsed.tags)
    ) {
      return {
        data: typeof parsed.id === 'string' ? parsed.id : '',
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
      const msats = Number.parseInt(tag[1], 10)
      if (!Number.isNaN(msats)) {
        results.push({
          amount: Math.floor(msats / MILLISATS_PER_SAT),
          currency: 'sats',
          relay: tag[2]
        })
      }
    }
  }
  return results
}

function parseMsatsTag(tags: string[][], name: string): number | undefined {
  const tag = tags.find((t) => t[0] === name)
  if (!tag || !tag[1]) {
    return undefined
  }
  const msats = Number.parseInt(tag[1], 10)
  return Number.isNaN(msats) || msats <= 0
    ? undefined
    : Math.floor(msats / MILLISATS_PER_SAT)
}

export function extractEnhancedZapTags(tags: string[][]): NostrEnhancedZapTags {
  const zapGoalRaw = tags.find((t) => t[0] === 'zap-goal')
  const zapUsesRaw = tags.find((t) => t[0] === 'zap-uses')
  const zapPayerRaw = tags.find((t) => t[0] === 'zap-payer')
  const zapLnurlRaw = tags.find((t) => t[0] === 'zap-lnurl')

  const result: NostrEnhancedZapTags = {
    zapMax: parseMsatsTag(tags, 'zap-max'),
    zapMin: parseMsatsTag(tags, 'zap-min')
  }

  if (zapGoalRaw?.[1]) {
    const goalMsats = Number.parseInt(zapGoalRaw[1], 10)
    if (!Number.isNaN(goalMsats) && goalMsats > 0) {
      result.zapGoal = Math.floor(goalMsats / MILLISATS_PER_SAT)
    }
  }
  if (zapUsesRaw?.[1]) {
    const uses = Number.parseInt(zapUsesRaw[1], 10)
    if (!Number.isNaN(uses) && uses > 0) {
      result.zapUses = uses
    }
  }
  const [, zapPayerVal] = zapPayerRaw ?? []
  if (zapPayerVal && /^[a-f0-9]{64}$/i.test(zapPayerVal)) {
    result.zapPayer = zapPayerVal
  }
  const [, zapLnurlVal] = zapLnurlRaw ?? []
  if (zapLnurlVal && zapLnurlVal.includes('@')) {
    result.zapLnurl = zapLnurlVal
  }

  return result
}

export function withPubpayHashtag(
  tags: string[][],
  paymentRequestSelected: boolean
): string[][] {
  if (!paymentRequestSelected) {
    return tags
  }
  const alreadyTagged = tags.some(
    (tag) =>
      tag[0] === NOSTR_HASHTAG_TAG &&
      tag[1]?.toLowerCase() === NOSTR_PUBPAY_HASHTAG
  )
  if (alreadyTagged) {
    return tags
  }
  return [...tags, [NOSTR_HASHTAG_TAG, NOSTR_PUBPAY_HASHTAG]]
}

export function buildEnhancedZapTags(config: NostrEnhancedZapTags): string[][] {
  const tags: string[][] = []
  if (config.zapMin !== undefined && config.zapMin > 0) {
    tags.push(['zap-min', String(config.zapMin * MILLISATS_PER_SAT)])
  }
  if (config.zapMax !== undefined && config.zapMax > 0) {
    tags.push(['zap-max', String(config.zapMax * MILLISATS_PER_SAT)])
  }
  if (config.zapGoal !== undefined && config.zapGoal > 0) {
    tags.push(['zap-goal', String(config.zapGoal * MILLISATS_PER_SAT)])
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

export function hasNostrRelaysSelected(
  identityRelays: string[] | undefined,
  storeRelays: string[]
): boolean {
  return (identityRelays?.length ?? 0) > 0 || storeRelays.length > 0
}

/** Relays the connection probe actually reached. */
export function connectedRelayUrls(
  info: NostrRelayConnectionInfo | undefined
): string[] {
  if (info?.status !== 'connected') {
    return []
  }
  return (
    info.relayDetails
      ?.filter((relay) => relay.connected)
      .map((relay) => relay.url) ?? []
  )
}

/**
 * Count shown on the account card. A live connection counts the relays that
 * answered; otherwise the configured list (including indexer fallback).
 */
export function nostrAccountRelayCount(
  configuredRelays: string[],
  info: NostrRelayConnectionInfo | undefined
): number {
  const connected = connectedRelayUrls(info)
  return connected.length > 0 ? connected.length : configuredRelays.length
}

function normalizeRelayUrl(url: string): string {
  return url.trim().replace(/\/$/, '').toLowerCase()
}

export type RelayStatusNote = {
  label: string
  tone: 'bad' | 'ok' | 'pending'
}

/** Connected, the failure, or a pending check for one relay in a probe result. */
export function relayStatusNote(
  url: string,
  info: NostrRelayConnectionInfo | undefined,
  pending: boolean
): RelayStatusNote | null {
  const detail = info?.relayDetails?.find(
    (relay) => normalizeRelayUrl(relay.url) === normalizeRelayUrl(url)
  )
  if (!detail) {
    return pending
      ? { label: t('nostrIdentity.account.relayChecking'), tone: 'pending' }
      : null
  }
  if (detail.connected) {
    return { label: t('nostrIdentity.relays.statusConnected'), tone: 'ok' }
  }
  const label =
    !detail.error || detail.error === 'timeout'
      ? t('nostrIdentity.relays.statusTimeout')
      : detail.error
  return { label, tone: 'bad' }
}

/** "1 of 8 connected" when the saved list is larger than the live connection. */
export function nostrConnectedSummary(
  info: NostrRelayConnectionInfo | undefined,
  configuredCount: number
): string {
  const connectedCount = connectedRelayUrls(info).length
  if (connectedCount === 0 || configuredCount <= connectedCount) {
    return t('nostrIdentity.account.relayConnected')
  }
  return t('nostrIdentity.account.relayConnectedOf', {
    connected: connectedCount,
    total: configuredCount
  })
}

/** Profile line: count only, no relay hosts. */
export function nostrConnectedDetail(
  info: NostrRelayConnectionInfo | undefined,
  configuredCount: number
): string {
  const connectedCount = connectedRelayUrls(info).length
  const total = configuredCount > 0 ? configuredCount : connectedCount
  if (connectedCount === 0 || total === 0) {
    return t('nostrIdentity.account.relayConnected')
  }
  return t('nostrIdentity.account.relayConnectedCount', {
    connected: connectedCount,
    total
  })
}

/**
 * Checklist state for the identity relay editor. An explicit list wins.
 * With none saved, only the relays that are connected are checked — the
 * rest of the catalog stays available to add.
 */
export function relayEditorSelection(
  explicitRelays: string[],
  connectedRelays: string[],
  override: string[] | null
): string[] {
  if (override) {
    return override
  }
  if (explicitRelays.length > 0) {
    return explicitRelays
  }
  return connectedRelays
}
