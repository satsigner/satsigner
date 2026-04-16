import NDK, { type NDKEvent } from '@nostr-dev-kit/ndk'
import { type NostrEvent, finalizeEvent, nip57 } from 'nostr-tools'

import { PROFILE_CACHE_TTL_SECS } from '@/constants/nostr'
import {
  cacheEvents,
  cacheProfile,
  getCachedProfile,
  getCachedZapReceipts,
  getCachedZapsByPubkey,
  getNewestCachedTimestamp
} from '@/db/nostrCache'
import type { LNURLPayResponse } from '@/types/models/LNURL'
import { fetchLNURLPayDetails } from '@/utils/lnurl'
import { getSecretFromNsec } from '@/utils/nostr'

/**
 * Subscribe-based multi-event fetch. Keeps the subscription open so events
 * arriving after relays finish their WebSocket handshake are still captured.
 */
function subscribeAndCollect(
  ndk: NDK,
  filter: Record<string, unknown>,
  timeoutMs: number
): Promise<Set<NDKEvent>> {
  return new Promise((resolve) => {
    let settled = false
    const collected = new Set<NDKEvent>()
    const sub = ndk.subscribe(filter as never, { closeOnEose: false })

    const finish = () => {
      if (settled) {return}
      settled = true
      sub.stop()
      resolve(collected)
    }

    sub.on('event', (event: NDKEvent) => {
      collected.add(event)
    })
    sub.on('eose', () => {
      if (ndk.pool.connectedRelays().length > 0) {
        finish()
      }
    })
    setTimeout(finish, timeoutMs)
  })
}

export type ZapFlowParams = {
  recipientLud16: string
  recipientPubkeyHex: string
  senderNsec: string
  eventIdHex?: string
  eventKind?: number
  eventTags?: string[][]
  amountSats: number
  comment?: string
  relays: string[]
}

export type ZapFlowResult = {
  invoice: string
  zapRequestJson: string
}

export type ZapReceiptDirection = 'incoming' | 'outgoing'

export type ZapReceiptInfo = {
  id: string
  senderPubkey: string
  senderName?: string
  senderPicture?: string
  recipientPubkey?: string
  recipientName?: string
  recipientPicture?: string
  direction: ZapReceiptDirection
  amountSats: number
  comment?: string
  createdAt: number
  /** First `e` tag on the receipt: zapped note or other referenced event. */
  zappedEventId?: string
  /** Full kind-9735 event JSON (when fetched from relays in this session). */
  rawEventJson?: string
}

const MILLISATS_PER_SAT = 1000
const ZAP_INVOICE_TIMEOUT_MS = 15000

function getPPubkeysFromTags(tags: string[][]): string[] {
  return tags
    .filter((tag) => tag[0] === 'p' && typeof tag[1] === 'string')
    .map((tag) => tag[1] as string)
}

function getPPubkeysFromEvent(event: NDKEvent): string[] {
  const rows = event.tags.map((tag) =>
    tag.filter((v): v is string => typeof v === 'string')
  )
  return getPPubkeysFromTags(rows)
}

export function zapReceiptEventToRawJson(event: NDKEvent): string {
  const tags = event.tags.map((tag) =>
    tag.filter((v): v is string => typeof v === 'string')
  )
  return JSON.stringify(
    {
      content: event.content,
      created_at: event.created_at ?? 0,
      id: event.id,
      kind: event.kind ?? 9735,
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
  if (!descTag?.[1]) {return null}

  const bolt11Tag = tags.find((tag) => tag[0] === 'bolt11')
  let amountSats = 0

  if (bolt11Tag?.[1]) {
    amountSats = nip57.getSatoshisAmountFromBolt11(bolt11Tag[1])
  }

  try {
    const zapRequest = JSON.parse(descTag[1]) as {
      pubkey?: string
      content?: string
      tags?: string[][]
    }

    if (!zapRequest.pubkey) {return null}

    if (amountSats === 0) {
      const amountTag = zapRequest.tags?.find((tag) => tag[0] === 'amount')
      if (amountTag?.[1]) {
        amountSats = Math.floor(parseInt(amountTag[1], 10) / MILLISATS_PER_SAT)
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
      comment: zapRequest.content || undefined,
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
export function parseZapReceiptFromEvent(
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
export async function resolveZapEndpoint(
  lud16: string
): Promise<LNURLPayResponse> {
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
export function buildZapRequest(params: {
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
          id: params.eventIdHex,
          pubkey: params.recipientPubkeyHex,
          kind: params.eventKind ?? 1,
          tags: params.eventTags ?? [],
          content: '',
          created_at: 0,
          sig: ''
        } as NostrEvent,
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
        ZAP_INVOICE_TIMEOUT_MS
      )
    })
  ])

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Invoice request failed: ${response.status} ${errorText}`)
  }

  const data = (await response.json()) as { pr?: string }
  if (!data.pr) {
    throw new Error('No invoice returned from LNURL callback')
  }

  return data.pr
}

/**
 * Fetches kind 9735 zap receipt events for a given note from relays.
 * Checks SQLite cache first, then fetches newer receipts from relays.
 */
export async function fetchZapReceipts(
  eventIdHex: string,
  relays: string[],
  ownPubkeys: string[] = []
): Promise<ZapReceiptInfo[]> {
  const cachedEvents = getCachedZapReceipts(eventIdHex)
  const cachedReceipts: ZapReceiptInfo[] = []
  for (const ce of cachedEvents) {
    const parsed = parseZapReceiptFromTags(
      ce.event_id,
      ce.created_at,
      ce.tags,
      null
    )
    if (parsed) cachedReceipts.push(parsed)
  }

  const ndk = new NDK({
    autoConnectUserRelays: false,
    enableOutboxModel: false,
    explicitRelayUrls: relays
  })

  try {
    await ndk.connect(10000)

    const filter: Record<string, unknown> = {
      '#e': [eventIdHex],
      kinds: [9735 as never],
      limit: 50
    }
    const newestTs = cachedEvents.length > 0
      ? Math.max(...cachedEvents.map((e) => e.created_at))
      : null
    if (newestTs) {
      filter.since = newestTs + 1
    }

    const events = await subscribeAndCollect(ndk, filter, 15000)

    const freshReceipts: ZapReceiptInfo[] = []
    const freshEvents: { id: string; kind: number; pubkey: string; content: string; tags: string[][]; created_at: number }[] = []

    for (const event of events) {
      const parsed = parseZapReceiptFromEvent(event, null)
      if (parsed) {
        freshReceipts.push(parsed)
        const tags = event.tags.map((tag) =>
          tag.filter((v): v is string => typeof v === 'string')
        )
        freshEvents.push({
          id: event.id,
          content: event.content,
          created_at: event.created_at ?? 0,
          kind: event.kind ?? 9735,
          pubkey: event.pubkey,
          tags
        })
      }
    }

    if (freshEvents.length > 0) {
      cacheEvents(freshEvents, ownPubkeys)
    }

    return mergeZapReceiptsById([...cachedReceipts, ...freshReceipts])
  } finally {
    for (const relay of ndk.pool.relays.values()) {
      try {
        relay.disconnect()
      } catch {
        // relay may already be disconnected
      }
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
 * Fetches kind 9735 zap receipts targeting a specific pubkey (via #p tag).
 * Checks SQLite cache first, then fetches newer receipts from relays.
 */
export async function fetchZapsByPubkey(
  pubkeyHex: string,
  relays: string[],
  limit = 20,
  until?: number,
  ownPubkeys: string[] = []
): Promise<ZapReceiptInfo[]> {
  const cachedEvents = getCachedZapsByPubkey(pubkeyHex, limit, until)
  const cachedReceipts: ZapReceiptInfo[] = []
  for (const ce of cachedEvents) {
    const parsed = parseZapReceiptFromTags(
      ce.event_id,
      ce.created_at,
      ce.tags,
      pubkeyHex
    )
    if (parsed) cachedReceipts.push(parsed)
  }

  const ndk = new NDK({
    autoConnectUserRelays: false,
    enableOutboxModel: false,
    explicitRelayUrls: relays
  })

  try {
    await ndk.connect(10000)

    const filter: Record<string, unknown> = {
      '#p': [pubkeyHex],
      kinds: [9735 as never],
      limit
    }
    if (until) {
      filter.until = until
    } else {
      const newestTs = getNewestCachedTimestamp(9735)
      if (newestTs) {
        filter.since = newestTs + 1
      }
    }

    const events = await subscribeAndCollect(ndk, filter, 15000)

    const receipts: ZapReceiptInfo[] = []
    const freshEvents: { id: string; kind: number; pubkey: string; content: string; tags: string[][]; created_at: number }[] = []

    for (const event of events) {
      const parsed = parseZapReceiptFromEvent(event, pubkeyHex)
      if (parsed) {
        receipts.push({
          ...parsed,
          rawEventJson: zapReceiptEventToRawJson(event)
        })
        const tags = event.tags.map((tag) =>
          tag.filter((v): v is string => typeof v === 'string')
        )
        freshEvents.push({
          id: event.id,
          content: event.content,
          created_at: event.created_at ?? 0,
          kind: event.kind ?? 9735,
          pubkey: event.pubkey,
          tags
        })
      }
    }

    if (freshEvents.length > 0) {
      cacheEvents(freshEvents, ownPubkeys)
    }

    return mergeZapReceiptsById([...cachedReceipts, ...receipts])
  } finally {
    for (const relay of ndk.pool.relays.values()) {
      try {
        relay.disconnect()
      } catch {
        // relay may already be disconnected
      }
    }
  }
}

/**
 * Fetches kind 9735 receipts authored by this pubkey (when relays index it).
 * Merged with {@link fetchZapsByPubkey} to include zaps this profile paid for.
 */
export async function fetchZapsSentByPubkey(
  pubkeyHex: string,
  relays: string[],
  limit = 20,
  until?: number
): Promise<ZapReceiptInfo[]> {
  const ndk = new NDK({
    autoConnectUserRelays: false,
    enableOutboxModel: false,
    explicitRelayUrls: relays
  })

  try {
    await ndk.connect(10000)

    const filter: Record<string, unknown> = {
      authors: [pubkeyHex],
      kinds: [9735 as never],
      limit
    }
    if (until) {
      filter.until = until
    }

    const events = await subscribeAndCollect(ndk, filter, 15000)

    const receipts: ZapReceiptInfo[] = []

    for (const event of events) {
      const parsed = parseZapReceiptFromEvent(event, pubkeyHex)
      if (parsed?.direction === 'outgoing') {
        receipts.push({
          ...parsed,
          rawEventJson: zapReceiptEventToRawJson(event)
        })
      }
    }

    return receipts.toSorted((a, b) => b.createdAt - a.createdAt)
  } finally {
    for (const relay of ndk.pool.relays.values()) {
      try {
        relay.disconnect()
      } catch {
        // relay may already be disconnected
      }
    }
  }
}

/**
 * Resolves sender npubs to display names via kind 0 profiles.
 * Checks SQLite profile cache first; only fetches from relays for missing/stale pubkeys.
 * Mutates the receipts array in place for efficiency.
 */
export async function enrichZapReceipts(
  receipts: ZapReceiptInfo[],
  relays: string[]
): Promise<void> {
  if (receipts.length === 0) {return}

  const now = Math.floor(Date.now() / 1000)
  const profileMap = new Map<string, { name?: string; picture?: string }>()

  const uniquePubkeys = [
    ...new Set(
      receipts.flatMap((r) =>
        [r.senderPubkey, r.recipientPubkey].filter(
          (k): k is string => typeof k === 'string' && k.length > 0
        )
      )
    )
  ].slice(0, 40)

  const stalePubkeys: string[] = []
  for (const pk of uniquePubkeys) {
    const cached = getCachedProfile(pk)
    if (cached && now - cached.cached_at < PROFILE_CACHE_TTL_SECS) {
      if (cached.displayName || cached.picture) {
        profileMap.set(pk, {
          name: cached.displayName,
          picture: cached.picture
        })
      }
    } else {
      stalePubkeys.push(pk)
    }
  }

  if (stalePubkeys.length > 0) {
    const ndk = new NDK({
      autoConnectUserRelays: false,
      enableOutboxModel: false,
      explicitRelayUrls: relays
    })

    try {
      await ndk.connect(8000)

      const events = await subscribeAndCollect(
        ndk,
        {
          authors: stalePubkeys,
          kinds: [0 as never],
          limit: stalePubkeys.length
        },
        10000
      )

      for (const event of events) {
        try {
          const content = JSON.parse(event.content) as Record<string, unknown>
          const name =
            typeof content.name === 'string'
              ? content.name
              : typeof content.display_name === 'string'
                ? content.display_name
                : undefined
          const picture =
            typeof content.picture === 'string' ? content.picture : undefined
          const nip05 =
            typeof content.nip05 === 'string' ? content.nip05 : undefined
          const lud16 =
            typeof content.lud16 === 'string' ? content.lud16 : undefined
          if (name || picture) {
            profileMap.set(event.pubkey, { name, picture })
          }
          cacheProfile(
            event.pubkey,
            { displayName: name, lud16, nip05, picture },
            event.id,
            event.created_at ?? 0
          )
        } catch {
          // malformed kind 0
        }
      }
    } finally {
      for (const relay of ndk.pool.relays.values()) {
        try {
          relay.disconnect()
        } catch {
          // relay may already be disconnected
        }
      }
    }
  }

  for (const receipt of receipts) {
    const senderProfile = profileMap.get(receipt.senderPubkey)
    if (senderProfile) {
      receipt.senderName = senderProfile.name
      receipt.senderPicture = senderProfile.picture
    }
    if (receipt.recipientPubkey) {
      const recipientProfile = profileMap.get(receipt.recipientPubkey)
      if (recipientProfile) {
        receipt.recipientName = recipientProfile.name
        receipt.recipientPicture = recipientProfile.picture
      }
    }
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
  if (relays.length === 0) {return null}

  const ndk = new NDK({
    autoConnectUserRelays: false,
    enableOutboxModel: false,
    explicitRelayUrls: relays
  })

  try {
    await ndk.connect(10000)

    const events = await subscribeAndCollect(
      ndk,
      {
        ids: [zapReceiptId],
        kinds: [9735 as never],
        limit: 1
      },
      15000
    )

    for (const event of events) {
      if (event.id !== zapReceiptId) {continue}
      const parsed = parseZapReceiptFromEvent(event, profileHex)
      if (!parsed) {return null}
      return {
        ...parsed,
        rawEventJson: zapReceiptEventToRawJson(event)
      }
    }

    return null
  } finally {
    for (const relay of ndk.pool.relays.values()) {
      try {
        relay.disconnect()
      } catch {
        // relay may already be disconnected
      }
    }
  }
}
