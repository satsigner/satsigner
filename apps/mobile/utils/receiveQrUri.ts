import { SATS_PER_BITCOIN } from '@/constants/btc'
import { PAYJOIN_MIN_RECEIVE_SATS } from '@/constants/payjoin'
import { appendParamsToPayjoinUri } from '@/utils/payjoinUri'

function stripBitcoinPrefix(uri: string): string {
  if (uri.toLowerCase().startsWith('bitcoin:')) {
    return uri.substring(8)
  }
  return uri
}

/**
 * Advertise `pj=` only when amount is unset or meets the anti-probing floor.
 * A set amount below the floor yields a plain BIP21 QR while the mailbox can
 * stay alive.
 */
function shouldIncludePayjoinInUri(params: {
  amountSats?: number
  minReceiveSats?: number
}): boolean {
  const minReceive = params.minReceiveSats ?? PAYJOIN_MIN_RECEIVE_SATS
  if (params.amountSats === undefined) {
    return true
  }
  return params.amountSats >= minReceive
}

function buildReceiveQrUri(params: {
  amountSats?: number
  includeBitcoinPrefix: boolean
  includeLabel: boolean
  includePayjoin: boolean
  label?: string
  localAddress?: string
  localAddressQR?: string
  payjoinEnabled: boolean
  payjoinSessionAddress?: string
  payjoinSessionStatus?: string
  payjoinSessionUri?: string
  payjoinUri?: string
}): string {
  const advertisePayjoin =
    params.includePayjoin &&
    params.payjoinEnabled &&
    shouldIncludePayjoinInUri({ amountSats: params.amountSats })
  const sessionMatchesAddress =
    !params.localAddress ||
    !params.payjoinSessionAddress ||
    params.payjoinSessionAddress === params.localAddress
  const sessionUri =
    advertisePayjoin && sessionMatchesAddress
      ? params.payjoinUri ||
        (params.payjoinSessionStatus !== 'expired'
          ? params.payjoinSessionUri
          : undefined)
      : undefined

  if (sessionUri) {
    let uri = sessionUri
    try {
      uri = appendParamsToPayjoinUri(sessionUri, {
        amountSats: params.amountSats,
        label: params.includeLabel ? params.label : undefined
      })
    } catch {
      uri = sessionUri
    }
    if (!params.includeBitcoinPrefix) {
      return stripBitcoinPrefix(uri)
    }
    return uri
  }

  if (!params.localAddressQR) {
    return ''
  }

  const queryParts: string[] = []
  if (params.amountSats !== undefined) {
    const amountInBtc = params.amountSats / SATS_PER_BITCOIN
    const formattedAmount = amountInBtc.toFixed(8).replace(/\.?0+$/, '')
    queryParts.push(`amount=${encodeURIComponent(formattedAmount)}`)
  }
  if (params.includeLabel && params.label) {
    queryParts.push(`label=${encodeURIComponent(params.label)}`)
  }

  const baseUri = params.includeBitcoinPrefix
    ? params.localAddressQR
    : stripBitcoinPrefix(params.localAddressQR)

  return queryParts.length > 0 ? `${baseUri}?${queryParts.join('&')}` : baseUri
}

export { buildReceiveQrUri, shouldIncludePayjoinInUri }
