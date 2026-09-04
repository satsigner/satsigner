export function parsePositiveSats(amountText: string) {
  const amountSats = parseInt(amountText, 10)
  if (Number.isNaN(amountSats) || amountSats <= 0) {
    return null
  }
  return amountSats
}

export function buildLndPayInvoiceBody(
  paymentRequest: string,
  amountSat?: number
) {
  if (amountSat === undefined) {
    return { payment_request: paymentRequest }
  }
  return {
    amt: String(amountSat),
    payment_request: paymentRequest
  }
}
