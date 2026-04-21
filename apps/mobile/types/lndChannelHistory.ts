/** LND `ForwardingHistory` event (JSON subset). */
export type LndForwardingEvent = {
  amt_in?: string
  amt_out?: string
  chan_id_in?: string
  chan_id_out?: string
  fee?: string
  /** Deprecated in LND; seconds as string when `timestamp_ns` absent. */
  timestamp?: string
  timestamp_ns?: string
}

export type LndForwardingHistoryResponse = {
  forwarding_events?: LndForwardingEvent[]
  last_offset_index?: number
}

export type ChannelHistoryRow = {
  extraLine?: string
  feeSat: number
  id: string
  /** Outbound payment amount (sats) or forward amt_out (sats) for display. */
  primarySats: number
  source: 'forward' | 'payment'
  timestampSec: number
}
