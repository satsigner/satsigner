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

/** LND answered and the payment did not go through: safe to try again. */
export class LndPaymentFailedError extends Error {
  override name = 'LndPaymentFailedError'
}

export function assertLndPaymentSucceeded(response: {
  payment_error?: string
  status?: string
}) {
  const paymentError = response.payment_error?.trim()
  if (paymentError) {
    throw new LndPaymentFailedError(paymentError)
  }
  if (response.status?.toUpperCase() === 'FAILED') {
    throw new LndPaymentFailedError('Payment failed')
  }
}
