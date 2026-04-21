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
}

export type LndNodeDashboardData = {
  balance: LndProcessedBalance
  transactions: LndCombinedTransaction[]
}
