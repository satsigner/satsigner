import { useNow } from '@/hooks/useNow'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { formatPayjoinExpiryLabel } from '@/utils/payjoinExpiry'
import { parsePayjoinInvoice } from '@/utils/payjoinInvoice'

export function usePayjoinInvoice() {
  const payjoinUri = useTransactionBuilderStore((state) => state.payjoinUri)
  const nowMs = useNow()

  const payjoinInvoice = parsePayjoinInvoice(payjoinUri)
  const payjoinExpiryLabel = formatPayjoinExpiryLabel(
    payjoinInvoice?.expiresAt,
    nowMs
  )

  return { payjoinExpiryLabel, payjoinInvoice }
}
