import { type PayjoinInvoice } from '@/types/payjoin'
import { bitcoinAmountBtcToSats } from '@/utils/autoSelectUtxos'
import { parsePayjoinExpiresAtMs } from '@/utils/payjoinExpiry'
import { hasPayjoinParam, parsePayjoinUri } from '@/utils/payjoinUri'

// Parses the BIP21 URI being paid into a payjoin invoice. Undefined when the
// URI is missing, invalid, or carries no payjoin endpoint.
export function parsePayjoinInvoice(
  uri: string | undefined
): PayjoinInvoice | undefined {
  if (!uri || !hasPayjoinParam(uri)) {
    return undefined
  }
  const parsed = parsePayjoinUri(uri)
  if (!parsed.isValid || !parsed.params) {
    return undefined
  }
  const { address, amountBtc, label, pj, pjos } = parsed.params
  return {
    address,
    amountSats:
      amountBtc !== undefined && amountBtc > 0
        ? bitcoinAmountBtcToSats(amountBtc)
        : undefined,
    endpointKind: parsed.endpointKind,
    expiresAt: parsePayjoinExpiresAtMs(pj),
    label,
    pj,
    pjos,
    uri
  }
}
