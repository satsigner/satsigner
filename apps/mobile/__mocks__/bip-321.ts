/**
 * Thin mock for bip-321 (ESM-only; Jest uses this instead).
 * Exports types and minimal stubs so the wrapper can be unit-tested.
 */

export type Network = 'mainnet' | 'testnet' | 'signet' | 'regtest'

export type PaymentMethod = {
  type: 'onchain' | 'lightning' | 'offer' | 'silent-payment' | 'ark'
  value: string
  network?: Network
  valid: boolean
  error?: string
}

export type BIP321ParseResult = {
  address?: string
  network?: Network
  amount?: number
  label?: string
  message?: string
  paymentMethods: PaymentMethod[]
  requiredParams: string[]
  optionalParams: Record<string, string[]>
  valid: boolean
  errors: string[]
}

export type BIP321EncodeResult = {
  uri?: string
  valid: boolean
  errors?: string[]
}

export function parseBIP321(
  uri: string,
  _expectedNetwork?: Network
): BIP321ParseResult {
  const base = {
    paymentMethods: [] as PaymentMethod[],
    requiredParams: [],
    optionalParams: {},
    valid: false,
    errors: [] as string[]
  }
  const trimmed = uri.trim()
  if (!trimmed.toLowerCase().startsWith('bitcoin:')) {
    base.errors.push('Invalid URI: must start with bitcoin:')
    return base
  }
  const withoutPrefix = trimmed.slice(8)
  const [addressPart, query] = withoutPrefix.split('?')
  const address = addressPart?.trim() ?? ''
  const validAddress = address.length >= 26 && address.length <= 90
  if (!address && !query) {
    base.errors.push('No valid payment method')
    return base
  }
  if (address && !validAddress) {
    base.valid = false
    base.errors.push('Invalid address')
    return base
  }
  const result: BIP321ParseResult = {
    ...base,
    valid: true,
    errors: []
  }
  if (address) {
    const network: Network | undefined = address.startsWith('bcrt1')
      ? 'regtest'
      : address.startsWith('tb1') || /^[mn2]/.test(address)
        ? 'testnet'
        : address.startsWith('bc1') || /^[13]/.test(address)
          ? 'mainnet'
          : undefined
    result.address = address
    result.network = network
    result.paymentMethods.push({
      type: 'onchain',
      value: address,
      network: result.network,
      valid: true
    })
  }
  if (query) {
    const params = new URLSearchParams(query)
    const amountStr = params.get('amount')
    if (amountStr) result.amount = parseFloat(amountStr)
    result.label = params.get('label') ?? undefined
    result.message = params.get('message') ?? undefined
    const lightning = params.get('lightning')
    if (lightning) {
      result.paymentMethods.push({ type: 'lightning', value: lightning, valid: true })
    }
  }
  return result
}

export function encodeBIP321(params: {
  address: string
  amount?: number
  label?: string
  message?: string
  lightning?: string
}): BIP321EncodeResult {
  const ok =
    params.address &&
    params.address.length >= 26 &&
    params.address.length <= 90
  if (!ok) {
    return { valid: false, errors: ['Invalid address'] }
  }
  let uri = `bitcoin:${params.address}`
  const parts: string[] = []
  if (params.amount !== undefined && params.amount > 0) {
    parts.push(`amount=${params.amount < 0.0001 ? params.amount.toFixed(8).replace(/\.?0+$/, '') : params.amount}`)
  }
  if (params.label) parts.push(`label=${encodeURIComponent(params.label)}`)
  if (params.message) parts.push(`message=${encodeURIComponent(params.message)}`)
  if (params.lightning) parts.push(`lightning=${params.lightning}`)
  if (parts.length) uri += `?${parts.join('&')}`
  return { valid: true, uri }
}

export function validateBitcoinAddress(
  address: string,
  _expectedNetwork?: Network
): { valid: boolean; network?: Network; error?: string } {
  const ok = address && address.length >= 26 && address.length <= 90
  if (!ok) return { valid: false, error: 'Invalid address format' }
  const network: Network | undefined = address.startsWith('bcrt1')
    ? 'regtest'
    : address.startsWith('tb1') || /^[mn2]/.test(address)
      ? 'testnet'
      : address.startsWith('bc1') || /^[13]/.test(address)
        ? 'mainnet'
        : undefined
  return { valid: true, network }
}

export function validateLightningInvoice(invoice: string): {
  valid: boolean
  network?: Network
  error?: string
} {
  const lower = invoice.toLowerCase()
  if (/^ln(bc|tb|bcrt|tbs)/.test(lower) && invoice.length > 20) {
    const network: Network = lower.startsWith('lnbcrt')
      ? 'regtest'
      : lower.startsWith('lnbc')
        ? 'mainnet'
        : lower.startsWith('lntbs')
          ? 'signet'
          : 'testnet'
    return { valid: true, network }
  }
  return { valid: false, error: 'Invalid Lightning invoice prefix' }
}

export function validateBolt12Offer(offer: string): {
  valid: boolean
  error?: string
} {
  const lower = offer.toLowerCase()
  if (lower.startsWith('lno1') || lower.startsWith('lno')) {
    return { valid: lower.length > 10 }
  }
  return { valid: false, error: 'Invalid BOLT12 offer' }
}
