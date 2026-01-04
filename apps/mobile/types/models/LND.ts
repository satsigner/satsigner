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
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
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
  chains: string[]
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
  pending_htlcs: any[]
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

export type LNDConnectionStatus = {
  isConnected: boolean
  isConnecting: boolean
  nodeInfo?: LNDNodeInfo
  channels?: LNDChannel[]
  lastSync?: string
}
