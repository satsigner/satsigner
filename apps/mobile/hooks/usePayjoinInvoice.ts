import { useMemo } from 'react'

import { SATS_PER_BITCOIN } from '@/constants/btc'
import { useNow } from '@/hooks/useNow'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type PayjoinInvoice } from '@/types/payjoin'
import {
  formatPayjoinExpiryLabel,
  parsePayjoinExpiresAtMs
} from '@/utils/payjoinExpiry'
import { hasPayjoinParam, parsePayjoinUri } from '@/utils/payjoinUri'

/**
 * Parses the payjoin URI stored in the transaction builder into an invoice,
 * plus a live expiry label. `payjoinInvoice` is undefined when the payment is
 * not a payjoin.
 */
export function usePayjoinInvoice() {
  const payjoinUri = useTransactionBuilderStore((state) => state.payjoinUri)

  const payjoinInvoice = useMemo((): PayjoinInvoice | undefined => {
    if (!payjoinUri || !hasPayjoinParam(payjoinUri)) {
      return undefined
    }
    const parsed = parsePayjoinUri(payjoinUri)
    if (!parsed.isValid || !parsed.params) {
      return undefined
    }
    const amountSats =
      parsed.params.amountBtc !== undefined && parsed.params.amountBtc > 0
        ? Math.round(parsed.params.amountBtc * SATS_PER_BITCOIN)
        : undefined
    return {
      address: parsed.params.address,
      amountSats,
      endpointKind: parsed.endpointKind,
      expiresAt: parsePayjoinExpiresAtMs(parsed.params.pj),
      label: parsed.params.label,
      pj: parsed.params.pj,
      pjos: parsed.params.pjos,
      uri: payjoinUri
    }
  }, [payjoinUri])

  const nowMs = useNow()
  const payjoinExpiryLabel = formatPayjoinExpiryLabel(
    payjoinInvoice?.expiresAt,
    nowMs
  )

  return { payjoinExpiryLabel, payjoinInvoice }
}
