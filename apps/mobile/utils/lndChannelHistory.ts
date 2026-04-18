import { LND_REST } from '@/constants/lightningLnd'
import type {
  ChannelHistoryRow,
  LndForwardingEvent,
  LndForwardingHistoryResponse
} from '@/types/lndChannelHistory'
import type { LndPayment } from '@/types/lndNodeDashboard'
import type { LNDRequest } from '@/types/models/LND'
import { parseLndSats } from '@/utils/lndChannelDetail'

const FORWARDING_MAX_EVENTS = 200
const FORWARDING_INDEX_OFFSET = 0

function forwardingEventKey(ev: LndForwardingEvent): string {
  return [
    ev.timestamp_ns ?? '',
    ev.chan_id_in ?? '',
    ev.chan_id_out ?? '',
    ev.amt_in ?? '',
    ev.amt_out ?? '',
    ev.fee ?? ''
  ].join('|')
}

function timestampNsToSec(timestampNs: string | undefined): number {
  if (!timestampNs || !timestampNs.trim()) {
    return 0
  }
  try {
    const sec = BigInt(timestampNs) / 1_000_000_000n
    const n = Number(sec)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function forwardingEventTimestampSec(ev: LndForwardingEvent): number {
  const fromNs = timestampNsToSec(ev.timestamp_ns)
  if (fromNs > 0) {
    return fromNs
  }
  if (ev.timestamp != null && String(ev.timestamp).trim() !== '') {
    const n = Number(ev.timestamp)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function paymentUsesChannel(payment: LndPayment, chanId: string): boolean {
  const target = String(chanId).trim()
  if (!target) {
    return false
  }
  for (const h of payment.htlcs ?? []) {
    const hops = h.route?.hops ?? []
    for (const hop of hops) {
      if (String(hop.chan_id ?? '').trim() === target) {
        return true
      }
    }
  }
  return false
}

async function fetchPaymentsSafe(
  makeRequest: LNDRequest
): Promise<LndPayment[]> {
  try {
    const res = await makeRequest<{ payments?: LndPayment[] }>(
      LND_REST.PAYMENTS,
      { disconnectOnError: false }
    )
    return res.payments ?? []
  } catch {
    return []
  }
}

export async function fetchChannelHistoryRows(
  makeRequest: LNDRequest,
  chanId: string
): Promise<ChannelHistoryRow[]> {
  const idNorm = chanId.trim()
  if (!idNorm) {
    return []
  }

  const requestBase = {
    index_offset: FORWARDING_INDEX_OFFSET,
    num_max_events: FORWARDING_MAX_EVENTS,
    peer_alias_lookup: true
  }

  const settled = await Promise.allSettled([
    makeRequest<LndForwardingHistoryResponse>(LND_REST.SWITCH_FORWARDING, {
      body: { ...requestBase, incoming_chan_ids: [idNorm] },
      disconnectOnError: false,
      method: 'POST'
    }),
    makeRequest<LndForwardingHistoryResponse>(LND_REST.SWITCH_FORWARDING, {
      body: { ...requestBase, outgoing_chan_ids: [idNorm] },
      disconnectOnError: false,
      method: 'POST'
    })
  ])

  const inRes: LndForwardingHistoryResponse =
    settled[0].status === 'fulfilled' ? settled[0].value : {}
  const outRes: LndForwardingHistoryResponse =
    settled[1].status === 'fulfilled' ? settled[1].value : {}

  const seen = new Set<string>()
  const forwardRows: ChannelHistoryRow[] = []

  for (const ev of [
    ...(inRes.forwarding_events ?? []),
    ...(outRes.forwarding_events ?? [])
  ]) {
    const k = forwardingEventKey(ev)
    if (seen.has(k)) {
      continue
    }
    seen.add(k)
    const amtIn = parseLndSats(ev.amt_in)
    const amtOut = parseLndSats(ev.amt_out)
    forwardRows.push({
      extraLine: `in ${ev.chan_id_in ?? '—'} → out ${ev.chan_id_out ?? '—'} • in ${amtIn} sats / out ${amtOut} sats`,
      feeSat: parseLndSats(ev.fee),
      id: `f-${k}`,
      primarySats: amtOut,
      source: 'forward',
      timestampSec: forwardingEventTimestampSec(ev)
    })
  }

  const payments = await fetchPaymentsSafe(makeRequest)

  const paymentRows: ChannelHistoryRow[] = []
  for (const p of payments) {
    if (!paymentUsesChannel(p, idNorm)) {
      continue
    }
    const ts = Number(p.creation_date || 0)
    paymentRows.push({
      extraLine: p.payment_hash ?? '',
      feeSat: parseLndSats(p.fee_sat),
      id: `p-${p.payment_hash}`,
      primarySats: Math.abs(Number(p.value_sat || 0)),
      source: 'payment',
      timestampSec: Number.isFinite(ts) ? ts : 0
    })
  }

  return [...forwardRows, ...paymentRows].toSorted(
    (a, b) => b.timestampSec - a.timestampSec
  )
}
