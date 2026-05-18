export type Bolt11Decoded = {
  route_hints?: unknown[]
  sections: Bolt11Section[]
}

export type Bolt11Section = {
  name: string
  value: string | number
}

export type LightningChannelHistoryRow = {
  extraLine?: string
  feeSat: number
  id: string
  primarySats: number
  /** Outbound payment amount (sats) or forward amt_out (sats) for display. */
  source: 'forward' | 'payment'
  timestampSec: number
}

export type LNDBlockchainBalanceResponse = {
  account_balance?: {
    [key: string]: {
      confirmed_balance: string
      unconfirmed_balance: string
    }
  }
  confirmed_balance: string
  locked_balance: string
  reserved_balance_anchor_chan: string
  total_balance: string
  unconfirmed_balance: string
}

export type LNDChanBackupSnapshot = {
  multi_chan_backup?: { multi_chan_backup?: string }
  single_chan_backups?: unknown
}

export type LNDChannelBalanceResponse = {
  balance: string
  custom_channel_data?: string
  local_balance: {
    msat: string
    sat: string
  }
  pending_open_balance: string
  pending_open_local_balance: {
    msat: string
    sat: string
  }
  pending_open_remote_balance: {
    msat: string
    sat: string
  }
  remote_balance: {
    msat: string
    sat: string
  }
  unsettled_local_balance: {
    msat: string
    sat: string
  }
  unsettled_remote_balance: {
    msat: string
    sat: string
  }
}

export type LNDCombinedTransaction = {
  amount: number
  description?: string
  expiry?: number
  fee?: number
  hash: string
  id: string
  num_confirmations?: number
  originalAmount?: number
  status: string
  timestamp: number
  type: 'onchain' | 'lightning_send' | 'lightning_receive'
}

export type LNDForwardingEvent = {
  amt_in?: string
  amt_out?: string
  chan_id_in?: string
  chan_id_out?: string
  fee?: string
  /** Deprecated in LND; seconds as string when `timestamp_ns` absent. */
  timestamp?: string
  timestamp_ns?: string
}

export type LNDForwardingHistoryResponse = {
  forwarding_events?: LNDForwardingEvent[]
  last_offset_index?: number
}

export type LNDInvoice = {
  add_index: string
  amt_paid_msat: string
  amt_paid_sat: string
  cltv_expiry: string
  creation_date: string
  description: string
  expiry: string
  memo?: string
  payment_addr: string
  payment_msat: string
  payment_request: string
  payment_sat: string
  r_hash: string
  settle_date: string
  settled: boolean
  state: string
  value: string
  value_msat: string
}

export type LNDListPeersResponse = {
  peers?: LNDRestPeer[]
}

export type LNDNodeDashboardData = {
  balance: LNDProcessedBalance
  rawInvoices: Record<string, LNDInvoice>
  rawOnchainTxs: Record<string, LNDOnchainTransaction>
  rawPayments: Record<string, LNDPayment>
  transactions: LNDCombinedTransaction[]
}

export type LNDOnchainTransaction = {
  amount: string
  block_hash: string
  block_height: number
  dest_addresses: string[]
  label: string
  num_confirmations: number
  raw_tx_hex: string
  time_stamp: string
  total_fees: string
  tx_hash: string
}

export type LNDPayment = {
  creation_date: string
  creation_time_ns: string
  fee: string
  fee_msat: string
  fee_sat: string
  htlcs: {
    route: {
      hops: {
        amt_to_forward: string
        amt_to_forward_msat: string
        chan_capacity: string
        chan_id: string
        expiry: number
        fee: string
        fee_msat: string
        pub_key: string
      }[]
      total_amt: string
      total_amt_msat: string
      total_fees: string
      total_fees_msat: string
      total_time_lock: number
    }
    status: string
  }[]
  /** Human-readable memo when returned by the node (optional). */
  memo?: string
  payment_hash: string
  payment_preimage: string
  payment_request: string
  status: string
  value: string
  value_msat: string
  value_sat: string
}

export type LNDPendingChannelsResponse = {
  pending_closing_channels?: unknown[]
  pending_force_closing_channels?: unknown[]
  pending_open_channels?: unknown[]
  waiting_close_channels?: unknown[]
}

export type LNDProcessedBalance = {
  channel_balance: number
  onchain_balance: number
  total_balance: number
}

export type LNDRestPeer = {
  address?: string
  pub_key?: string
}

export type LNDChannel = {
  active: boolean
  capacity: number
  chan_id: string
  chan_status_flags: string
  channel_point: string
  close_address: string
  commit_fee: number
  commit_weight: number
  commitment_type: string
  csv_delay: number
  fee_per_kw: number
  initiator: boolean
  lifetime: number
  local_balance: number
  local_chan_reserve_sat: number
  local_constraints: LNDChannelConstraints
  num_updates: number
  /** Gossip alias for the remote peer when known (newer LND REST). */
  peer_alias?: string
  pending_htlcs: unknown[]
  private: boolean
  push_amount_sat: number
  remote_balance: number
  remote_chan_reserve_sat: number
  remote_constraints: LNDChannelConstraints
  remote_pubkey: string
  static_remote_key: boolean
  thaw_height: number
  total_satoshis_received: number
  total_satoshis_sent: number
  unsettled_balance: number
  uptime: number
}

export type LNDChannelConstraints = {
  chan_reserve_sat: number
  csv_delay: number
  dust_limit_sat: number
  max_accepted_htlcs: number
  max_pending_amt_msat: number
  min_htlc_msat: number
}

export type LNDConfig = {
  cert: string
  macaroon: string
  url: string
}

export type LNDDecodedInvoice = {
  description: string
  expiry: string
  features: Record<string, { name: string }>
  min_final_cltv_expiry: string
  num_msat: string
  num_satoshis: string
  payment_addr: string
  payment_hash: string
  payment_request: string
  payment_secret: string
  route_hints: unknown[]
  timestamp: string
  value: string
}

export type LNDGetInfoChain = {
  chain: string
  network: string
}

export type LNDGraphNodeInfo = {
  alias: string
  color: string
  pub_key: string
}

export type LNDNodeInfo = {
  alias: string
  best_header_timestamp: string
  block_hash: string
  block_height: number
  chains: LNDGetInfoChain[]
  commit_hash: string
  identity_pubkey: string
  num_active_channels: number
  num_peers: number
  synced_to_chain: boolean
  uris: string[]
  version: string
}

export type LNDPaymentResponse = {
  payment_hash: string
  payment_preimage: string
  status: string
}

export type LNDRequest = <T>(
  endpoint: string,
  options?: LNDRequestOptions
) => Promise<T>

export type LNDRequestOptions = {
  body?: unknown
  /** When false, HTTP errors do not clear `isConnected` (for optional reads). */
  disconnectOnError?: boolean
  headers?: Record<string, string>
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
}

export type LNURLPayInvoiceResponse = {
  pr: string // bolt11 invoice
  routes: unknown[] // payment routes, not used in our implementation
}

export type LNURLPayResponse = {
  allowsNostr?: boolean
  callback: string
  commentAllowed?: number
  maxSendable: number
  metadata: string
  minSendable: number
  nostrPubkey?: string
  tag: 'payRequest'
}

export type LNURLWithdrawDetails = {
  callback: string
  defaultDescription?: string
  k1: string
  maxWithdrawable: number
  minWithdrawable: number
  tag: 'withdrawRequest'
}

export type LNURLWithdrawResponse = {
  pr?: string
  reason?: string
  status: 'OK' | 'ERROR'
}
