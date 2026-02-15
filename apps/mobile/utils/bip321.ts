import {
  encodeBIP321,
  parseBIP321,
  validateBitcoinAddress,
  validateBolt12Offer,
  validateLightningInvoice,
  type BIP321ParseResult,
  type Network as Bip321Network
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
  if (!network) return undefined
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
  if (!network) return undefined
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
      label: result.label,
      message: result.message,
      lightning: result.paymentMethods?.find((m) => m.type === 'lightning')
        ?.value,
      network: bip321NetworkToAppNetwork(result.network),
      isValid: true
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
      uri: result.uri || '',
      isValid: result.valid,
      error: result.errors?.join(', ')
    }
  } catch (error) {
    return {
      uri: '',
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
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
  if (!uri) return false
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
  address: string,
  _expectedNetwork?: AppNetwork
): BitcoinAddressValidationResult {
  const result = validateBitcoinAddress(address)
  return {
    isValid: result.valid,
    network: bip321NetworkToAppNetwork(result.network),
    error: result.error
  }
}

export function validateLightning(invoice: string): LightningValidationResult {
  const result = validateLightningInvoice(invoice)
  return {
    isValid: result.valid,
    network: result.network,
    appNetwork: bip321NetworkToAppNetwork(result.network),
    error: result.error
  }
}

export function validateBolt12(offer: string): Bolt12ValidationResult {
  const result = validateBolt12Offer(offer)
  return {
    isValid: result.valid,
    error: result.error
  }
}

export {
  type BitcoinAddressValidationResult,
  type Bolt12ValidationResult,
  type EncodeBitcoinUriParams,
  type EncodeBitcoinUriResult,
  type LightningValidationResult,
  type ParsedBitcoinUri
}
