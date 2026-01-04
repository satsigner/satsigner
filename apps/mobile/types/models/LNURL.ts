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

export type LNURLType = 'pay' | 'withdraw'
