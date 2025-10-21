export type DecodedInvoice = {
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

