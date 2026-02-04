/**
 * Mock implementation of bip-321 for Jest tests
 * This mock provides the core functionality needed for testing
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

// Network detection from address prefix
function detectNetworkFromAddress(address: string): Network | undefined {
  if (
    address.startsWith('bc1') ||
    address.startsWith('1') ||
    address.startsWith('3')
  ) {
    return 'mainnet'
  }
  if (
    address.startsWith('tb1') ||
    address.startsWith('m') ||
    address.startsWith('n') ||
    address.startsWith('2')
  ) {
    return 'testnet'
  }
  if (address.startsWith('bcrt1')) {
    return 'regtest'
  }
  return undefined
}

// Validate Bitcoin address format (simplified)
function isValidBitcoinAddress(address: string): boolean {
  // Basic validation - check for known prefixes and reasonable length
  const validPrefixes = ['bc1', 'tb1', 'bcrt1', '1', '3', 'm', 'n', '2']
  const hasValidPrefix = validPrefixes.some((p) => address.startsWith(p))
  return hasValidPrefix && address.length >= 26 && address.length <= 90
}

export function parseBIP321(
  uri: string,
  _expectedNetwork?: Network
): BIP321ParseResult {
  const result: BIP321ParseResult = {
    paymentMethods: [],
    requiredParams: [],
    optionalParams: {},
    valid: true,
    errors: []
  }

  try {
    const trimmed = uri.trim()
    const lowerUri = trimmed.toLowerCase()

    // Must start with bitcoin:
    if (!lowerUri.startsWith('bitcoin:')) {
      result.valid = false
      result.errors.push('Invalid URI: must start with bitcoin:')
      return result
    }

    // Remove the bitcoin: prefix
    const withoutPrefix = trimmed.substring(8)

    // Split address and query params
    const questionMarkIndex = withoutPrefix.indexOf('?')
    let addressPart = ''
    let queryString = ''

    if (questionMarkIndex === -1) {
      addressPart = withoutPrefix
    } else {
      addressPart = withoutPrefix.substring(0, questionMarkIndex)
      queryString = withoutPrefix.substring(questionMarkIndex + 1)
    }

    // Parse query params
    if (queryString) {
      const params = new URLSearchParams(queryString)
      const amountStr = params.get('amount')
      if (amountStr) {
        result.amount = parseFloat(amountStr)
      }
      result.label = params.get('label') || undefined
      result.message = params.get('message') || undefined

      const lightning = params.get('lightning')
      if (lightning) {
        result.paymentMethods.push({
          type: 'lightning',
          value: lightning,
          valid: true
        })
      }
    }

    // Validate address if present
    if (addressPart) {
      if (!isValidBitcoinAddress(addressPart)) {
        result.valid = false
        result.errors.push('Invalid address')
        return result
      }
      result.address = addressPart
      result.network = detectNetworkFromAddress(addressPart)
      result.paymentMethods.push({
        type: 'onchain',
        value: addressPart,
        network: result.network,
        valid: true
      })
    }

    // For lightning-only URIs (bitcoin:?lightning=...)
    if (!addressPart && result.paymentMethods.length === 0) {
      result.valid = false
      result.errors.push('No valid payment method')
    }

    return result
  } catch {
    result.valid = false
    result.errors.push('Parse error')
    return result
  }
}

export function encodeBIP321(params: {
  address: string
  amount?: string
  label?: string
  message?: string
  lightning?: string
}): BIP321EncodeResult {
  try {
    if (!params.address || !isValidBitcoinAddress(params.address)) {
      return { valid: false, errors: ['Invalid address'] }
    }

    let uri = `bitcoin:${params.address}`
    const queryParts: string[] = []

    if (params.amount !== undefined && params.amount > 0) {
      // Format amount to avoid scientific notation
      const formattedAmount =
        params.amount < 0.0001
          ? params.amount.toFixed(8).replace(/\.?0+$/, '')
          : params.amount.toString()
      queryParts.push(`amount=${formattedAmount}`)
    }
    if (params.label) {
      queryParts.push(`label=${encodeURIComponent(params.label)}`)
    }
    if (params.message) {
      queryParts.push(`message=${encodeURIComponent(params.message)}`)
    }
    if (params.lightning) {
      queryParts.push(`lightning=${params.lightning}`)
    }

    if (queryParts.length > 0) {
      uri += `?${queryParts.join('&')}`
    }

    return { valid: true, uri }
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }
  }
}

export function validateBitcoinAddress(
  address: string,
  _expectedNetwork?: Network
): { valid: boolean; network?: Network; error?: string } {
  if (!isValidBitcoinAddress(address)) {
    return { valid: false, error: 'Invalid address format' }
  }

  return {
    valid: true,
    network: detectNetworkFromAddress(address)
  }
}

export function validateLightningInvoice(invoice: string): {
  valid: boolean
  network?: Network
  error?: string
} {
  const lower = invoice.toLowerCase()

  if (lower.startsWith('lnbcrt')) {
    return { valid: lower.length > 20, network: 'regtest' }
  }
  if (lower.startsWith('lnbc')) {
    return { valid: lower.length > 20, network: 'mainnet' }
  }
  if (lower.startsWith('lntbs')) {
    return { valid: lower.length > 20, network: 'signet' }
  }
  if (lower.startsWith('lntb')) {
    return { valid: lower.length > 20, network: 'testnet' }
  }

  return { valid: false, error: 'Invalid Lightning invoice prefix' }
}

export function validateBolt12Offer(offer: string): {
  valid: boolean
  error?: string
} {
  const lower = offer.toLowerCase()
  // BOLT12 offers start with lno1
  if (lower.startsWith('lno1') || lower.startsWith('lno')) {
    return { valid: lower.length > 10 }
  }
  return { valid: false, error: 'Invalid BOLT12 offer' }
}
