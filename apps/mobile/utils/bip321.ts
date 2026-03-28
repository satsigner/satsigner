import {
  type BIP321ParseResult,
  encodeBIP321,
  type Network as Bip321Network,
  parseBIP321,
  validateBitcoinAddress,
  validateBolt12Offer,
  validateLightningInvoice
} from 'bip-321'

import { SATS_PER_BITCOIN } from '@/constants/btc'
import { type Network as AppNetwork } from '@/types/settings/blockchain'

type ParsedBitcoinUri = {
  address: string
  amount?: number
  label?: string
  message?: string
  lightning?: string
  network?: AppNetwork
  isValid: boolean
}

type EncodeBitcoinUriParams = {
  address: string
  amount?: number
  label?: string
  message?: string
  lightning?: string
}

type EncodeBitcoinUriResult = {
  uri: string
  isValid: boolean
  error?: string
}

type BitcoinAddressValidationResult = {
  isValid: boolean
  network?: AppNetwork
  error?: string
}

type LightningValidationResult = {
  isValid: boolean
  network?: Bip321Network
  appNetwork?: AppNetwork
  error?: string
}

type Bolt12ValidationResult = {
  isValid: boolean
  error?: string
}

function bip321NetworkToAppNetwork(
  network: Bip321Network | undefined
): AppNetwork | undefined {
  if (!network) {
    return undefined
  }
  switch (network) {
    case 'mainnet':
      return 'bitcoin'
    case 'testnet':
      return 'testnet'
    case 'signet':
      return 'signet'
    case 'regtest':
      return 'testnet'
    default:
      return undefined
  }
}

function appNetworkToBip321Network(
  network: AppNetwork | undefined
): Bip321Network | undefined {
  if (!network) {
    return undefined
  }
  switch (network) {
    case 'bitcoin':
      return 'mainnet'
    case 'testnet':
      return 'testnet'
    case 'signet':
      return 'signet'
    default:
      return undefined
  }
}

export function parseBitcoinUri(
  uri: string,
  expectedNetwork?: AppNetwork
): ParsedBitcoinUri {
  try {
    const bip321ExpectedNetwork = appNetworkToBip321Network(expectedNetwork)
    const result: BIP321ParseResult = parseBIP321(uri, bip321ExpectedNetwork)

    if (!result.valid) {
      return {
        address: '',
        isValid: false
      }
    }

    const bitcoinMethod = result.paymentMethods?.find(
      (m) => m.type === 'onchain'
    )

    return {
      address: bitcoinMethod?.value || result.address || '',
      amount: result.amount,
      isValid: true,
      label: result.label,
      lightning: result.paymentMethods?.find((m) => m.type === 'lightning')
        ?.value,
      message: result.message,
      network: bip321NetworkToAppNetwork(result.network)
    }
  } catch {
    return {
      address: '',
      isValid: false
    }
  }
}

export function parseBitcoinUriWithSats(
  uri: string,
  expectedNetwork?: AppNetwork
): ParsedBitcoinUri & { amountSats?: number } {
  const parsed = parseBitcoinUri(uri, expectedNetwork)
  if (!parsed.isValid) {
    return { ...parsed, amountSats: undefined }
  }

  const amountSats = parsed.amount
    ? Math.round(parsed.amount * SATS_PER_BITCOIN)
    : undefined

  return {
    ...parsed,
    amountSats
  }
}

export function encodeBitcoinUri(
  params: EncodeBitcoinUriParams
): EncodeBitcoinUriResult {
  try {
    const encodeParams: {
      address: string
      amount?: number
      label?: string
      message?: string
      lightning?: string
    } = {
      address: params.address
    }

    if (params.amount !== undefined && params.amount > 0) {
      encodeParams.amount = params.amount
    }

    if (params.label) {
      encodeParams.label = params.label
    }

    if (params.message) {
      encodeParams.message = params.message
    }

    if (params.lightning) {
      encodeParams.lightning = params.lightning
    }

    const result = encodeBIP321(encodeParams)

    return {
      error: result.errors?.join(', '),
      isValid: result.valid,
      uri: result.uri || ''
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      isValid: false,
      uri: ''
    }
  }
}

export function encodeBitcoinUriFromSats(
  address: string,
  amountSats?: number,
  label?: string,
  message?: string
): EncodeBitcoinUriResult {
  const amountBtc =
    amountSats !== undefined && amountSats > 0
      ? amountSats / SATS_PER_BITCOIN
      : undefined

  return encodeBitcoinUri({
    address,
    amount: amountBtc,
    label,
    message
  })
}

export function isBitcoinUri(uri: string): boolean {
  if (!uri) {
    return false
  }
  const trimmed = uri.trim()
  if (!trimmed.toLowerCase().startsWith('bitcoin:')) {
    return false
  }
  const result = parseBitcoinUri(trimmed)
  return result.isValid
}

export function getAddressFromUri(uri: string): string | null {
  const parsed = parseBitcoinUri(uri)
  return parsed.isValid ? parsed.address : null
}

export function validateBitcoinAddressWithNetwork(
  address: string
): BitcoinAddressValidationResult {
  const result = validateBitcoinAddress(address)
  return {
    error: result.error,
    isValid: result.valid,
    network: bip321NetworkToAppNetwork(result.network)
  }
}

export function validateLightning(invoice: string): LightningValidationResult {
  const result = validateLightningInvoice(invoice)
  return {
    appNetwork: bip321NetworkToAppNetwork(result.network),
    error: result.error,
    isValid: result.valid,
    network: result.network
  }
}

export function validateBolt12(offer: string): Bolt12ValidationResult {
  const result = validateBolt12Offer(offer)
  return {
    error: result.error,
    isValid: result.valid
  }
}
