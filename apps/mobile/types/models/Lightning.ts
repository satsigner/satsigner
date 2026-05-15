export type LNDGraphNodeInfo = {
  alias: string
  color: string
  pub_key: string
}

export type LNDecodedInvoice = {
  payment_request: string
  value: string
  description: string
  timestamp: string
  expiry: string
  payment_hash: string
  payment_addr: string
  num_satoshis: string
  num_msat: string
  features: Record<string, { name: string }>
  route_hints: unknown[]
  payment_secret: string
  min_final_cltv_expiry: string
}

export type LNDRequestOptions = {
  body?: unknown
  /** When false, HTTP errors do not clear `isConnected` (for optional reads). */
  disconnectOnError?: boolean
  headers?: Record<string, string>
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
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

export type LNDConfig = {
  macaroon: string
  cert: string
  url: string
}
/** One entry from LND `GET /v1/getinfo` `chains` (REST mirrors gRPC `Chain`). */

export type LNDGetInfoChain = {
  chain: string
  network: string
}

export type LNDNodeInfo = {
  version: string
  commit_hash: string
  identity_pubkey: string
  alias: string
  num_active_channels: number
  num_peers: number
  block_height: number
  block_hash: string
  best_header_timestamp: string
  synced_to_chain: boolean
  chains: LNDGetInfoChain[]
  uris: string[]
}

export type LNDChannelConstraints = {
  csv_delay: number
  chan_reserve_sat: number
  dust_limit_sat: number
  max_pending_amt_msat: number
  min_htlc_msat: number
  max_accepted_htlcs: number
}

export type LNDChannel = {
  active: boolean
  /** Gossip alias for the remote peer when known (newer LND REST). */
  peer_alias?: string
  remote_pubkey: string
  channel_point: string
  chan_id: string
  capacity: number
  local_balance: number
  remote_balance: number
  commit_fee: number
  commit_weight: number
  fee_per_kw: number
  unsettled_balance: number
  total_satoshis_sent: number
  total_satoshis_received: number
  num_updates: number
  pending_htlcs: unknown[]
  csv_delay: number
  private: boolean
  initiator: boolean
  chan_status_flags: string
  local_chan_reserve_sat: number
  remote_chan_reserve_sat: number
  static_remote_key: boolean
  commitment_type: string
  lifetime: number
  uptime: number
  close_address: string
  push_amount_sat: number
  thaw_height: number
  local_constraints: LNDChannelConstraints
  remote_constraints: LNDChannelConstraints
}
export type LNURLPayResponse = {
  callback: string
  maxSendable: number
  minSendable: number
  metadata: string
  tag: 'payRequest'
  commentAllowed?: number
  nostrPubkey?: string
  allowsNostr?: boolean
}

export type LNURLPayInvoiceResponse = {
  pr: string // bolt11 invoice
  routes: unknown[] // payment routes, not used in our implementation
}

export type LNURLWithdrawDetails = {
  callback: string
  k1: string
  minWithdrawable: number
  maxWithdrawable: number
  defaultDescription?: string
  tag: 'withdrawRequest'
}

export type LNURLWithdrawResponse = {
  status: 'OK' | 'ERROR'
  pr?: string
  reason?: string
}

export type LndBlockchainBalanceResponse = {
  total_balance: string
  confirmed_balance: string
  unconfirmed_balance: string
  locked_balance: string
  reserved_balance_anchor_chan: string
  account_balance?: {
    [key: string]: {
      confirmed_balance: string
      unconfirmed_balance: string
    }
  }
}

export type LndChannelBalanceResponse = {
  balance: string
  pending_open_balance: string
  local_balance: {
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
  pending_open_local_balance: {
    msat: string
    sat: string
  }
  pending_open_remote_balance: {
    msat: string
    sat: string
  }
  custom_channel_data?: string
}

export type LndOnchainTransaction = {
  tx_hash: string
  amount: string
  num_confirmations: number
  block_hash: string
  block_height: number
  time_stamp: string
  total_fees: string
  dest_addresses: string[]
  raw_tx_hex: string
  label: string
}

export type LndPayment = {
  payment_hash: string
  value: string
  creation_date: string
  fee: string
  /** Human-readable memo when returned by the node (optional). */
  memo?: string
  payment_preimage: string
  value_sat: string
  value_msat: string
  payment_request: string
  status: string
  fee_sat: string
  fee_msat: string
  creation_time_ns: string
  htlcs: {
    status: string
    route: {
      hops: {
        chan_id: string
        chan_capacity: string
        amt_to_forward: string
        fee: string
        expiry: number
        amt_to_forward_msat: string
        fee_msat: string
        pub_key: string
      }[]
      total_time_lock: number
      total_amt: string
      total_amt_msat: string
      total_fees: string
      total_fees_msat: string
    }
  }[]
}

export type LndInvoice = {
  r_hash: string
  payment_request: string
  add_index: string
  payment_addr: string
  payment_sat: string
  payment_msat: string
  settled: boolean
  settle_date: string
  state: string
  value: string
  value_msat: string
  creation_date: string
  description: string
  memo?: string
  expiry: string
  cltv_expiry: string
  amt_paid_sat: string
  amt_paid_msat: string
}

export type LndProcessedBalance = {
  total_balance: number
  channel_balance: number
  onchain_balance: number
}

export type LndCombinedTransaction = {
  id: string
  type: 'onchain' | 'lightning_send' | 'lightning_receive'
  amount: number
  timestamp: number
  status: string
  hash: string
  description?: string
  num_confirmations?: number
  fee?: number
  originalAmount?: number
  expiry?: number
}

export type LndNodeDashboardData = {
  balance: LndProcessedBalance
  transactions: LndCombinedTransaction[]
  rawInvoices: Record<string, LndInvoice>
  rawPayments: Record<string, LndPayment>
  rawOnchainTxs: Record<string, LndOnchainTransaction>
}
/** LND REST `ListPeers` (subset). */
export type LndListPeersResponse = {
  peers?: LndRestPeer[]
}

export type LndRestPeer = {
  address?: string
  pub_key?: string
}
/** LND REST `PendingChannels` (subset; arrays only for counts / light UI). */

export type LndPendingChannelsResponse = {
  pending_closing_channels?: unknown[]
  pending_force_closing_channels?: unknown[]
  pending_open_channels?: unknown[]
  waiting_close_channels?: unknown[]
}
/** LND REST `ExportAllChannelBackups` JSON (subset). */

export type LndChanBackupSnapshot = {
  multi_chan_backup?: { multi_chan_backup?: string }
  single_chan_backups?: unknown
}
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
