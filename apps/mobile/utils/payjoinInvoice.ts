import { t } from '@/locales'
import { type PayjoinInvoice } from '@/types/payjoin'
import { bitcoinAmountBtcToSats } from '@/utils/autoSelectUtxos'
import { formatAddress, formatNumber } from '@/utils/format'
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

// One-line summary of a payjoin invoice: endpoint kind, amount, label,
// address and expiry, joined with " · ". Empty parts are skipped.
export function formatPayjoinSummary(
  invoice: PayjoinInvoice,
  expiryLabel: string | null
) {
  return [
    invoice.endpointKind === 'bip78'
      ? t('transaction.build.payjoin.data.bip78')
      : t('transaction.build.payjoin.data.bip77'),
    invoice.amountSats !== undefined
      ? `${formatNumber(invoice.amountSats)} ${t('bitcoin.sats')}`
      : null,
    invoice.label || null,
    formatAddress(invoice.address, 'default'),
    expiryLabel
  ]
    .filter(Boolean)
    .join(' · ')
}
