export interface LNURLPayResponse {
  callback: string
  maxSendable: number
  minSendable: number
  metadata: string
  tag: 'payRequest'
  commentAllowed?: number
  nostrPubkey?: string
  allowsNostr?: boolean
}

export interface LNURLPayInvoiceResponse {
  pr: string // bolt11 invoice
  routes: unknown[] // payment routes, not used in our implementation
}

export interface LNURLWithdrawDetails {
  callback: string
  k1: string
  minWithdrawable: number
  maxWithdrawable: number
  defaultDescription?: string
  tag: 'withdrawRequest'
}

export interface LNURLWithdrawResponse {
  status: 'OK' | 'ERROR'
  pr?: string
  reason?: string
}
