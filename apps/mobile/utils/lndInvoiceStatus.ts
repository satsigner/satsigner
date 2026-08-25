export type LndInvoiceUiStatus = 'canceled' | 'open' | 'settled'

export function lndInvoiceLookupPath(rHash: string): string {
  return `/v1/invoice/${Buffer.from(rHash, 'base64').toString('hex')}`
}

export function parseLndInvoiceUiStatus(state: string): LndInvoiceUiStatus {
  const lower = state.toLowerCase()
  if (lower === 'settled') {
    return 'settled'
  }
  if (lower === 'canceled') {
    return 'canceled'
  }
  return 'open'
}
