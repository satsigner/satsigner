export function parsePositiveSats(amountText: string) {
  const normalizedAmount = amountText.trim()
  if (!/^\d+$/.test(normalizedAmount)) {
    return null
  }
  const amountSats = Number(normalizedAmount)
  if (!Number.isSafeInteger(amountSats) || amountSats <= 0) {
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

export function assertLndPaymentSucceeded(response: {
  payment_error?: string
  status?: string
}) {
  const paymentError = response.payment_error?.trim()
  if (paymentError) {
    throw new Error(paymentError)
  }
  if (response.status?.toUpperCase() === 'FAILED') {
    throw new Error('Payment failed')
  }
}
