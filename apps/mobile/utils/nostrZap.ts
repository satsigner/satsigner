import { type NDKEvent, type NDKFilter } from '@nostr-dev-kit/ndk'
import type NDK from '@nostr-dev-kit/ndk'
import { finalizeEvent, nip19, nip57 } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'

import { createEphemeralNdk, disconnectNdkPool } from '@/api/ndkRegistry'
import { fetchProfilesCoalesced } from '@/api/nostrProfileFetcher'
import { connectToFirstRelay } from '@/api/nostrRelayHealth'
import { MILLISATS_PER_SAT } from '@/constants/btc'
import {
  NOSTR_PROFILE_BATCH_SIZE,
  NOSTR_ZAP_CACHE_LOOKUP_LIMIT,
  NOSTR_ZAP_COLLECT_TIMEOUT_MS,
  NOSTR_ZAP_CONNECT_TIMEOUT_MS,
  NOSTR_ZAP_INVOICE_TIMEOUT_MS,
  NOSTR_ZAP_RECEIPT_FETCH_LIMIT
} from '@/constants/nostr'
import {
  type CachedEvent,
  cacheEvents,
  getCachedZapReceipts,
  getCachedZapsByPubkey,
  getNewestCachedZapTimestamp
} from '@/db/nostrCache'
import type { LNURLPayResponse } from '@/types/models/Lightning'
import {
  type NostrFetchResult,
  type NostrKind0Profile,
  ZapReceiptInfo,
  ZapReceiptDirection,
  ZapFlowParams,
  ZapFlowResult,
  ZapSortField
} from '@/types/models/Nostr'
import { NostrNoRelaysError, NostrRelayTimeoutError } from '@/utils/errors'
import { formatNpub } from '@/utils/format'
import { fetchLNURLPayDetails } from '@/utils/lnurl'
import { getSecretFromNsec } from '@/utils/nostr'
import { getNostrErrorCode } from '@/utils/nostrErrorMessage'
import { getNostrTagValue } from '@/utils/nostrEvent'
import { isRecord } from '@/utils/object'

type ZapFetchResult = NostrFetchResult<ZapReceiptInfo[]>

type ZapPageQuery = {
  limit: number
  ownPubkeys?: string[]
  pubkeyHex: string
  relays: string[]
  until?: number
}

/**
 * Collects events until a connected relay answers EOSE. A timeout with
 * nothing collected and no EOSE throws NostrRelayTimeoutError, so an outage
 * never looks like "no zaps".
 */
function subscribeAndCollect(
  ndk: NDK,
  filter: NDKFilter,
  timeoutMs: number
): Promise<Set<NDKEvent>> {
  return new Promise((resolve, reject) => {
    const state = { settled: false }
    const collected = new Set<NDKEvent>()
    const sub = ndk.subscribe(filter, { closeOnEose: false })

    function finish(answered: boolean) {
      if (state.settled) {
        return
      }
      state.settled = true
      clearTimeout(timer)
      sub.stop()
      if (!answered && collected.size === 0) {
        reject(new NostrRelayTimeoutError('No relay answered the zap REQ'))
        return
      }
      resolve(collected)
    }

    const timer = setTimeout(() => finish(false), timeoutMs)

    sub.on('event', (event: NDKEvent) => {
      collected.add(event)
    })
    sub.on('eose', () => {
      if (ndk.pool.connectedRelays().length > 0) {
        finish(true)
      }
    })
  })
}

/** One short-lived pool per zap query; always torn down. */
async function collectFromRelays(
  relays: string[],
  filter: NDKFilter
): Promise<Set<NDKEvent>> {
  if (relays.length === 0) {
    throw new NostrNoRelaysError('No relays configured')
  }
  const ndk = createEphemeralNdk(relays)
  try {
    await connectToFirstRelay(ndk, NOSTR_ZAP_CONNECT_TIMEOUT_MS)
    return await subscribeAndCollect(ndk, filter, NOSTR_ZAP_COLLECT_TIMEOUT_MS)
  } finally {
    disconnectNdkPool(ndk)
  }
}

function toStringTags(event: NDKEvent): string[][] {
  return event.tags.map((tag) =>
    tag.filter((v): v is string => typeof v === 'string')
  )
}

function toCacheableZap(event: NDKEvent) {
  return {
    content: event.content,
    created_at: event.created_at ?? 0,
    id: event.id,
    kind: event.kind ?? nostrKinds.Zap,
    pubkey: event.pubkey,
    tags: toStringTags(event)
  }
}

function parseCachedZaps(
  cached: CachedEvent[],
  profileHex: string | null
): ZapReceiptInfo[] {
  return cached.flatMap((event) => {
    const parsed = parseZapReceiptFromTags(
      event.event_id,
      event.created_at,
      event.tags,
      profileHex
    )
    return parsed ? [parsed] : []
  })
}

/** Parses relay receipts (keeping the raw JSON) and caches the valid ones. */
function ingestZapEvents(
  events: Set<NDKEvent>,
  profileHex: string | null,
  ownPubkeys: string[]
): ZapReceiptInfo[] {
  const parsedEvents = [...events].flatMap((event) => {
    const parsed = parseZapReceiptFromEvent(event, profileHex)
    return parsed ? [{ event, parsed }] : []
  })
  cacheEvents(
    parsedEvents.map(({ event }) => toCacheableZap(event)),
    ownPubkeys
  )
  return parsedEvents.map(({ event, parsed }) => ({
    ...parsed,
    rawEventJson: zapReceiptEventToRawJson(event)
  }))
}

function getPPubkeysFromTags(tags: string[][]): string[] {
  return tags
    .filter(
      (tag): tag is [string, string, ...string[]] =>
        tag[0] === 'p' && typeof tag[1] === 'string'
    )
    .map((tag) => tag[1])
}

function zapReceiptEventToRawJson(event: NDKEvent): string {
  const tags = event.tags.map((tag) =>
    tag.filter((v): v is string => typeof v === 'string')
  )
  return JSON.stringify(
    {
      content: event.content,
      created_at: event.created_at ?? 0,
      id: event.id,
      kind: event.kind ?? nostrKinds.Zap,
      pubkey: event.pubkey,
      sig: event.sig,
      tags
    },
    null,
    2
  )
}

/**
 * Parses a kind 9735 zap receipt from normalized tags (e.g. after JSON fetch).
 */
export function parseZapReceiptFromTags(
  id: string,
  createdAt: number,
  tags: string[][],
  profileHex: string | null
): ZapReceiptInfo | null {
  const descTag = tags.find((tag) => tag[0] === 'description')
  if (!descTag?.[1]) {
    return null
  }

  const bolt11Tag = tags.find((tag) => tag[0] === 'bolt11')
  let amountSats = 0

  if (bolt11Tag?.[1]) {
    amountSats = nip57.getSatoshisAmountFromBolt11(bolt11Tag[1])
  }

  try {
    const zapRequest: unknown = JSON.parse(descTag[1])

    if (
      !isRecord(zapRequest) ||
      typeof zapRequest.pubkey !== 'string' ||
      !zapRequest.pubkey
    ) {
      return null
    }

    if (amountSats === 0) {
      const amountMillisats = getNostrTagValue(zapRequest.tags, 'amount')
      if (amountMillisats) {
        amountSats = Math.floor(
          Number.parseInt(amountMillisats, 10) / MILLISATS_PER_SAT
        )
      }
    }

    const zapper = zapRequest.pubkey
    const pPubkeys = getPPubkeysFromTags(tags)
    const eTag = tags.find((tag) => tag[0] === 'e' && tag[1])
    const zappedEventId =
      typeof eTag?.[1] === 'string' && eTag[1].length > 0 ? eTag[1] : undefined
    let direction: ZapReceiptDirection = 'incoming'
    let recipientPubkey: string | undefined

    if (profileHex) {
      const profileL = profileHex.toLowerCase()
      const outgoing = zapper.toLowerCase() === profileL
      if (outgoing) {
        direction = 'outgoing'
        recipientPubkey =
          pPubkeys.find((p) => p.toLowerCase() !== profileL) ?? pPubkeys[0]
      }
    }

    return {
      amountSats,
      comment:
        typeof zapRequest.content === 'string' && zapRequest.content
          ? zapRequest.content
          : undefined,
      createdAt,
      direction,
      id,
      recipientPubkey,
      senderPubkey: zapper,
      zappedEventId
    }
  } catch {
    return null
  }
}

/**
 * Parses a kind 9735 zap receipt. When `profileHex` is set, classifies
 * incoming (others zapped this profile) vs outgoing (this profile zapped).
 * With `profileHex` null, direction is always incoming (e.g. note zaps list).
 */
function parseZapReceiptFromEvent(
  event: NDKEvent,
  profileHex: string | null
): ZapReceiptInfo | null {
  const tags = event.tags.map((tag) =>
    tag.filter((v): v is string => typeof v === 'string')
  )
  return parseZapReceiptFromTags(
    event.id,
    event.created_at ?? 0,
    tags,
    profileHex
  )
}

export function mergeZapReceiptsById(
  receipts: ZapReceiptInfo[]
): ZapReceiptInfo[] {
  const map = new Map<string, ZapReceiptInfo>()
  for (const r of receipts) {
    const prev = map.get(r.id)
    if (!prev) {
      map.set(r.id, r)
    } else {
      map.set(r.id, {
        ...prev,
        ...r,
        rawEventJson: r.rawEventJson ?? prev.rawEventJson,
        zappedEventId: r.zappedEventId ?? prev.zappedEventId
      })
    }
  }
  return [...map.values()].toSorted((a, b) => b.createdAt - a.createdAt)
}

/**
 * Resolves a Lightning Address (lud16) to an LNURL-pay callback URL.
 * Returns the full LNURLPayResponse with callback, min/max, and nostr support.
 */
function resolveZapEndpoint(lud16: string): Promise<LNURLPayResponse> {
  const [name, domain] = lud16.split('@')
  if (!name || !domain) {
    throw new Error('Invalid Lightning Address format')
  }

  const url = `https://${domain}/.well-known/lnurlp/${name}`
  return fetchLNURLPayDetails(url)
}

/**
 * Builds and signs a NIP-57 kind 9734 zap request event.
 * Returns the signed event as a JSON string (ready for the nostr= callback param).
 */
function buildZapRequest(params: {
  senderNsec: string
  recipientPubkeyHex: string
  amountSats: number
  eventIdHex?: string
  eventKind?: number
  eventTags?: string[][]
  comment?: string
  relays: string[]
}): string {
  const secretKey = getSecretFromNsec(params.senderNsec)
  if (!secretKey) {
    throw new Error('Invalid sender nsec')
  }

  const amountMsats = params.amountSats * MILLISATS_PER_SAT

  const zapRequestTemplate = params.eventIdHex
    ? nip57.makeZapRequest({
        amount: amountMsats,
        comment: params.comment,
        event: {
          content: '',
          created_at: 0,
          id: params.eventIdHex,
          kind: params.eventKind ?? 1,
          pubkey: params.recipientPubkeyHex,
          sig: '',
          tags: params.eventTags ?? []
        },
        relays: params.relays
      })
    : nip57.makeZapRequest({
        amount: amountMsats,
        comment: params.comment,
        pubkey: params.recipientPubkeyHex,
        relays: params.relays
      })

  const signedEvent = finalizeEvent(zapRequestTemplate, secretKey)
  return JSON.stringify(signedEvent)
}

/**
 * Requests a BOLT11 invoice from the LNURL callback, including the
 * NIP-57 nostr= query parameter with the signed zap request.
 */
export async function requestZapInvoice(
  callback: string,
  amountSats: number,
  zapRequestJson: string,
  comment?: string,
  lnurlDetails?: LNURLPayResponse
): Promise<string> {
  const amountMsats = amountSats * MILLISATS_PER_SAT

  const url = new URL(callback)
  url.searchParams.set('amount', amountMsats.toString())
  url.searchParams.set('nostr', zapRequestJson)
  if (comment && lnurlDetails?.commentAllowed) {
    url.searchParams.set('comment', comment)
  }

  const response = await Promise.race([
    fetch(url.toString()),
    new Promise<never>((_resolve, reject) => {
      setTimeout(
        () => reject(new Error('Invoice request timed out')),
        NOSTR_ZAP_INVOICE_TIMEOUT_MS
      )
    })
  ])

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Invoice request failed: ${response.status} ${errorText}`)
  }

  const data: unknown = await response.json()
  if (!isRecord(data) || typeof data.pr !== 'string' || !data.pr) {
    throw new Error('No invoice returned from LNURL callback')
  }

  return data.pr
}

/**
 * Kind 9735 zap receipts for a note: cached receipts first, then newer ones
 * from relays. On relay failure the cached receipts come back with source
 * 'cache' and the error code.
 */
export async function fetchZapReceipts(
  eventIdHex: string,
  relays: string[],
  ownPubkeys: string[] = []
): Promise<ZapFetchResult> {
  const cachedEvents = getCachedZapReceipts(
    eventIdHex,
    NOSTR_ZAP_CACHE_LOOKUP_LIMIT
  )
  const cachedReceipts = parseCachedZaps(cachedEvents, null)

  const filter: NDKFilter = {
    '#e': [eventIdHex],
    kinds: [nostrKinds.Zap],
    limit: NOSTR_ZAP_RECEIPT_FETCH_LIMIT
  }
  const [newestCached] = cachedEvents
  if (newestCached) {
    filter.since = newestCached.created_at + 1
  }

  try {
    const events = await collectFromRelays(relays, filter)
    const fresh = ingestZapEvents(events, null, ownPubkeys)
    return {
      data: mergeZapReceiptsById([...cachedReceipts, ...fresh]),
      source: 'relay'
    }
  } catch (error) {
    return {
      data: cachedReceipts,
      error: getNostrErrorCode(error),
      source: 'cache'
    }
  }
}

/**
 * Full zap flow: resolve lud16, build zap request, fetch BOLT11 invoice.
 * Returns the invoice and signed zap request ready for payment.
 */
export async function initiateZap(
  params: ZapFlowParams
): Promise<ZapFlowResult> {
  const lnurlDetails = await resolveZapEndpoint(params.recipientLud16)

  if (!lnurlDetails.allowsNostr || !lnurlDetails.nostrPubkey) {
    throw new Error('Recipient does not support Nostr zaps')
  }

  const amountMsats = params.amountSats * MILLISATS_PER_SAT
  if (amountMsats < lnurlDetails.minSendable) {
    throw new Error(
      `Minimum zap is ${Math.ceil(lnurlDetails.minSendable / MILLISATS_PER_SAT)} sats`
    )
  }
  if (amountMsats > lnurlDetails.maxSendable) {
    throw new Error(
      `Maximum zap is ${Math.floor(lnurlDetails.maxSendable / MILLISATS_PER_SAT)} sats`
    )
  }

  const zapRequestJson = buildZapRequest({
    amountSats: params.amountSats,
    comment: params.comment,
    eventIdHex: params.eventIdHex,
    eventKind: params.eventKind,
    eventTags: params.eventTags,
    recipientPubkeyHex: params.recipientPubkeyHex,
    relays: params.relays,
    senderNsec: params.senderNsec
  })

  const invoice = await requestZapInvoice(
    lnurlDetails.callback,
    params.amountSats,
    zapRequestJson,
    params.comment,
    lnurlDetails
  )

  return { invoice, zapRequestJson }
}

/**
 * Kind 9735 zap receipts targeting a pubkey (#p). The head page only asks
 * relays for receipts newer than this pubkey's newest cached one. On relay
 * failure the cached receipts come back with source 'cache'.
 */
export async function fetchZapsByPubkey(
  pubkeyHex: string,
  relays: string[],
  limit = NOSTR_ZAP_RECEIPT_FETCH_LIMIT,
  until?: number,
  ownPubkeys: string[] = []
): Promise<ZapFetchResult> {
  const cachedReceipts = parseCachedZaps(
    getCachedZapsByPubkey(pubkeyHex, limit, until),
    pubkeyHex
  )

  const filter: NDKFilter = {
    '#p': [pubkeyHex],
    kinds: [nostrKinds.Zap],
    limit
  }
  const newestCachedTs = until ? null : getNewestCachedZapTimestamp(pubkeyHex)
  if (until) {
    filter.until = until
  } else if (newestCachedTs) {
    filter.since = newestCachedTs + 1
  }

  try {
    const events = await collectFromRelays(relays, filter)
    const fresh = ingestZapEvents(events, pubkeyHex, ownPubkeys)
    return {
      data: mergeZapReceiptsById([...cachedReceipts, ...fresh]).slice(0, limit),
      source: 'relay'
    }
  } catch (error) {
    return {
      data: cachedReceipts,
      error: getNostrErrorCode(error),
      source: 'cache'
    }
  }
}

/**
 * Kind 9735 receipts authored by this pubkey (when relays index it), kept
 * only when this profile is the zapper. Throws when relays are unreachable.
 */
export async function fetchZapsSentByPubkey(
  pubkeyHex: string,
  relays: string[],
  limit = NOSTR_ZAP_RECEIPT_FETCH_LIMIT,
  until?: number
): Promise<ZapReceiptInfo[]> {
  const filter: NDKFilter = {
    authors: [pubkeyHex],
    kinds: [nostrKinds.Zap],
    limit
  }
  if (until) {
    filter.until = until
  }
  const events = await collectFromRelays(relays, filter)
  return [...events]
    .flatMap((event) => {
      const parsed = parseZapReceiptFromEvent(event, pubkeyHex)
      return parsed?.direction === 'outgoing'
        ? [{ ...parsed, rawEventJson: zapReceiptEventToRawJson(event) }]
        : []
    })
    .toSorted((a, b) => b.createdAt - a.createdAt)
}

/** One page of a profile's zaps (received and sent), newest first. */
export async function fetchZapsPage({
  limit,
  ownPubkeys = [],
  pubkeyHex,
  relays,
  until
}: ZapPageQuery): Promise<ZapFetchResult> {
  const [incoming, sent] = await Promise.all([
    fetchZapsByPubkey(pubkeyHex, relays, limit, until, ownPubkeys),
    fetchZapsSentByPubkey(pubkeyHex, relays, limit, until).then(
      (data): ZapFetchResult => ({ data, source: 'relay' }),
      (error: unknown): ZapFetchResult => ({
        data: [],
        error: getNostrErrorCode(error),
        source: 'cache'
      })
    )
  ])
  return {
    data: mergeZapReceiptsById([...incoming.data, ...sent.data]),
    error: incoming.error ?? sent.error,
    source: incoming.source
  }
}

/**
 * Attaches sender/recipient names and pictures from kind 0 profiles. Goes
 * through the shared profile batcher, so fresh cached profiles cost nothing.
 */
export async function enrichZapReceipts(
  receipts: ZapReceiptInfo[],
  relays: string[]
): Promise<ZapReceiptInfo[]> {
  const pubkeys = [
    ...new Set(
      receipts.flatMap((r) =>
        [r.senderPubkey, r.recipientPubkey].filter(
          (k): k is string => typeof k === 'string' && k.length > 0
        )
      )
    )
  ].slice(0, NOSTR_PROFILE_BATCH_SIZE)
  if (pubkeys.length === 0) {
    return receipts
  }
  const profiles = await fetchProfilesCoalesced(pubkeys, relays)
  return receipts.map((receipt) =>
    applyZapProfiles(receipt, (pk) => profiles.get(pk.toLowerCase()))
  )
}

/** Copies sender/recipient profile fields onto a receipt (pure). */
export function applyZapProfiles(
  receipt: ZapReceiptInfo,
  getProfile: (pubkeyHex: string) => NostrKind0Profile | null | undefined
): ZapReceiptInfo {
  const sender = getProfile(receipt.senderPubkey)
  const recipient = receipt.recipientPubkey
    ? getProfile(receipt.recipientPubkey)
    : undefined
  return {
    ...receipt,
    ...(sender
      ? {
          senderLud16: sender.lud16,
          senderName: sender.displayName,
          senderNip05: sender.nip05,
          senderPicture: sender.picture
        }
      : {}),
    ...(recipient
      ? {
          recipientLud16: recipient.lud16,
          recipientName: recipient.displayName,
          recipientNip05: recipient.nip05,
          recipientPicture: recipient.picture
        }
      : {})
  }
}

/**
 * Loads a single kind-9735 zap receipt by id from relays.
 */
export async function fetchZapReceiptById(
  zapReceiptId: string,
  profileHex: string | null,
  relays: string[]
): Promise<ZapReceiptInfo | null> {
  if (relays.length === 0) {
    return null
  }
  const events = await collectFromRelays(relays, {
    ids: [zapReceiptId],
    kinds: [nostrKinds.Zap],
    limit: 1
  })
  const event = [...events].find((candidate) => candidate.id === zapReceiptId)
  if (!event) {
    return null
  }
  const parsed = parseZapReceiptFromEvent(event, profileHex)
  return parsed
    ? { ...parsed, rawEventJson: zapReceiptEventToRawJson(event) }
    : null
}

export function sortZapReceipts(
  receipts: ZapReceiptInfo[],
  field: ZapSortField,
  asc: boolean
): ZapReceiptInfo[] {
  return [...receipts].toSorted((a, b) => {
    const m = asc ? 1 : -1
    if (field === 'amount') {
      return (a.amountSats - b.amountSats) * m
    }
    return (a.createdAt - b.createdAt) * m
  })
}

export function countQualifyingZaps(
  receipts: ZapReceiptInfo[],
  min?: number,
  max?: number
): number {
  return receipts.filter((r) => {
    if (min !== undefined && r.amountSats < min) {
      return false
    }
    if (max !== undefined && r.amountSats > max) {
      return false
    }
    return true
  }).length
}

/** Who a zap row shows: the recipient for outgoing zaps, else the sender. */
export function getZapCounterpartyDisplay(receipt: ZapReceiptInfo): {
  avatarUri?: string
  displayName: string
  initial: string
} {
  const isOutgoing = receipt.direction === 'outgoing'
  const pubkey = isOutgoing ? receipt.recipientPubkey : receipt.senderPubkey
  const name = isOutgoing ? receipt.recipientName : receipt.senderName
  const fallbackName = pubkey ? formatNpub(nip19.npubEncode(pubkey), 'xs') : '?'
  return {
    avatarUri: isOutgoing ? receipt.recipientPicture : receipt.senderPicture,
    displayName: name || fallbackName,
    initial: name?.[0]?.toUpperCase() || '?'
  }
}

export type ZapSortState = { asc: boolean; field: ZapSortField }

/** Tapping the active field flips direction; another field starts descending. */
export function getNextZapSort(
  current: ZapSortState,
  field: ZapSortField
): ZapSortState {
  if (current.field === field) {
    return { asc: !current.asc, field }
  }
  return { asc: false, field }
}

/** Receipts arrive newest first, so the default order needs no sort. */
export function applyZapSort(
  receipts: ZapReceiptInfo[],
  { asc, field }: ZapSortState
): ZapReceiptInfo[] {
  if (field === 'date' && !asc) {
    return receipts
  }
  return sortZapReceipts(receipts, field, asc)
}
