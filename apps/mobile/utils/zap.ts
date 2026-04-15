import NDK, { type NDKEvent } from '@nostr-dev-kit/ndk'
import { type NostrEvent, finalizeEvent, nip57 } from 'nostr-tools'

import type { LNURLPayResponse } from '@/types/models/LNURL'
import { fetchLNURLPayDetails } from '@/utils/lnurl'
import { getSecretFromNsec } from '@/utils/nostr'

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

export type ZapReceiptInfo = {
  senderPubkey: string
  senderName?: string
  senderPicture?: string
  amountSats: number
  comment?: string
  createdAt: number
}

const MILLISATS_PER_SAT = 1000
const ZAP_INVOICE_TIMEOUT_MS = 15000

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
        event: {
          id: params.eventIdHex,
          pubkey: params.recipientPubkeyHex,
          kind: params.eventKind ?? 1,
          tags: params.eventTags ?? [],
          content: '',
          created_at: 0,
          sig: ''
        } as NostrEvent,
        amount: amountMsats,
        comment: params.comment,
        relays: params.relays
      })
    : nip57.makeZapRequest({
        pubkey: params.recipientPubkeyHex,
        amount: amountMsats,
        comment: params.comment,
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
 * Parses each receipt to extract sender, amount, and comment.
 */
export async function fetchZapReceipts(
  eventIdHex: string,
  relays: string[]
): Promise<ZapReceiptInfo[]> {
  const ndk = new NDK({
    autoConnectUserRelays: false,
    enableOutboxModel: false,
    explicitRelayUrls: relays
  })

  try {
    await ndk.connect(10000)
    if (ndk.pool.connectedRelays().length === 0) return []

    const events = await Promise.race([
      ndk.fetchEvents(
        { '#e': [eventIdHex], kinds: [9735 as never], limit: 50 },
        { closeOnEose: true }
      ),
      new Promise<Set<NDKEvent>>((resolve) => {
        setTimeout(() => resolve(new Set()), 15000)
      })
    ])

    const receipts: ZapReceiptInfo[] = []

    for (const event of events) {
      const descTag = event.tags.find((tag) => tag[0] === 'description')
      if (!descTag?.[1]) continue

      const bolt11Tag = event.tags.find((tag) => tag[0] === 'bolt11')
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

        if (!zapRequest.pubkey) continue

        if (amountSats === 0) {
          const amountTag = zapRequest.tags?.find(
            (tag) => tag[0] === 'amount'
          )
          if (amountTag?.[1]) {
            amountSats = Math.floor(
              parseInt(amountTag[1], 10) / MILLISATS_PER_SAT
            )
          }
        }

        receipts.push({
          senderPubkey: zapRequest.pubkey,
          amountSats,
          comment: zapRequest.content || undefined,
          createdAt: event.created_at ?? 0
        })
      } catch {
        // malformed zap request in description tag
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
    senderNsec: params.senderNsec,
    recipientPubkeyHex: params.recipientPubkeyHex,
    amountSats: params.amountSats,
    eventIdHex: params.eventIdHex,
    eventKind: params.eventKind,
    eventTags: params.eventTags,
    comment: params.comment,
    relays: params.relays
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
 * Used to show zaps received by a profile.
 */
export async function fetchZapsByPubkey(
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
    if (ndk.pool.connectedRelays().length === 0) return []

    const filter: Record<string, unknown> = {
      '#p': [pubkeyHex],
      kinds: [9735 as never],
      limit
    }
    if (until) {
      filter.until = until
    }

    const events = await Promise.race([
      ndk.fetchEvents(filter as never, { closeOnEose: true }),
      new Promise<Set<NDKEvent>>((resolve) => {
        setTimeout(() => resolve(new Set()), 15000)
      })
    ])

    const receipts: ZapReceiptInfo[] = []

    for (const event of events) {
      const descTag = event.tags.find((tag) => tag[0] === 'description')
      if (!descTag?.[1]) continue

      const bolt11Tag = event.tags.find((tag) => tag[0] === 'bolt11')
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

        if (!zapRequest.pubkey) continue

        if (amountSats === 0) {
          const amountTag = zapRequest.tags?.find(
            (tag) => tag[0] === 'amount'
          )
          if (amountTag?.[1]) {
            amountSats = Math.floor(
              parseInt(amountTag[1], 10) / MILLISATS_PER_SAT
            )
          }
        }

        receipts.push({
          senderPubkey: zapRequest.pubkey,
          amountSats,
          comment: zapRequest.content || undefined,
          createdAt: event.created_at ?? 0
        })
      } catch {
        // malformed zap request
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
 * Mutates the receipts array in place for efficiency.
 */
export async function enrichZapReceipts(
  receipts: ZapReceiptInfo[],
  relays: string[]
): Promise<void> {
  if (receipts.length === 0) return

  const ndk = new NDK({
    autoConnectUserRelays: false,
    enableOutboxModel: false,
    explicitRelayUrls: relays
  })

  try {
    await ndk.connect(8000)
    if (ndk.pool.connectedRelays().length === 0) return

    const uniquePubkeys = [
      ...new Set(receipts.map((r) => r.senderPubkey))
    ].slice(0, 20)

    const events = await Promise.race([
      ndk.fetchEvents(
        {
          authors: uniquePubkeys,
          kinds: [0 as never],
          limit: uniquePubkeys.length
        },
        { closeOnEose: true }
      ),
      new Promise<Set<NDKEvent>>((resolve) => {
        setTimeout(() => resolve(new Set()), 10000)
      })
    ])

    const profileMap = new Map<
      string,
      { name?: string; picture?: string }
    >()

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
        if (name || picture) {
          profileMap.set(event.pubkey, { name, picture })
        }
      } catch {
        // malformed kind 0
      }
    }

    for (const receipt of receipts) {
      const profile = profileMap.get(receipt.senderPubkey)
      if (profile) {
        receipt.senderName = profile.name
        receipt.senderPicture = profile.picture
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
