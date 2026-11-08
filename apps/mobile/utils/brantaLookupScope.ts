import { validateAddress } from '@/utils/validation'

const BITCOIN_URI_SCHEME = 'bitcoin:'

/** BIP21 params the Branta SDK ignores, so a URI with only these stays local. */
const LOCAL_BITCOIN_URI_PARAMS = new Set([
  'amount',
  'label',
  'message',
  'pj',
  'pjos'
])

function isLocalBitcoinUri(text: string): boolean {
  if (!text.toLowerCase().startsWith(BITCOIN_URI_SCHEME)) {
    return false
  }
  const rest = text.slice(BITCOIN_URI_SCHEME.length)
  const queryStart = rest.indexOf('?')
  const address = queryStart === -1 ? rest : rest.slice(0, queryStart)
  if (!validateAddress(address)) {
    return false
  }
  const query = queryStart === -1 ? '' : rest.slice(queryStart + 1)
  for (const key of new URLSearchParams(query).keys()) {
    if (!LOCAL_BITCOIN_URI_PARAMS.has(key.toLowerCase())) {
      return false
    }
  }
  return true
}

/**
 * The Branta SDK answers a plain on-chain address as unknown without a
 * network call, so there is nothing to ask consent for. Anything it might
 * send, or that this check does not recognise, still goes through consent.
 */
function brantaLookupMayReachNetwork(input: string): boolean {
  const text = input.trim()
  if (!text) {
    return false
  }
  if (validateAddress(text)) {
    return false
  }
  return !isLocalBitcoinUri(text)
}

export { brantaLookupMayReachNetwork }
