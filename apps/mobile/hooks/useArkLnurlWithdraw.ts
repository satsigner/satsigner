import { useMutation, useQuery } from '@tanstack/react-query'

import { createArkBolt11Invoice } from '@/api/ark'
import { ARK_LNURL_DETAILS_STALE_MS } from '@/constants/ark'
import { MILLISATS_PER_SAT } from '@/constants/btc'
import type { LNURLWithdrawDetails } from '@/types/models/Lightning'
import { getArkAccountOrThrow } from '@/utils/ark'
import {
  fetchLNURLWithdrawDetails,
  isLnurlWithdrawAmountInRange,
  requestLNURLWithdrawInvoice,
  resolveLnurlUrl
} from '@/utils/lnurl'

import { useArkWallet } from './useArkWallet'

export function useArkLnurlWithdrawDetails(
  accountId: string | null | undefined,
  lnurlRaw: string | null | undefined
) {
  return useQuery<LNURLWithdrawDetails>({
    enabled: Boolean(accountId && lnurlRaw),
    queryFn: () => {
      if (!lnurlRaw) {
        throw new Error('LNURL is required')
      }
      const url = resolveLnurlUrl(lnurlRaw)
      return fetchLNURLWithdrawDetails(url)
    },
    queryKey: ['ark', 'lnurl-withdraw', 'details', lnurlRaw],
    staleTime: ARK_LNURL_DETAILS_STALE_MS
  })
}

type WithdrawInput = {
  amountSats: number
  details: LNURLWithdrawDetails
}

type WithdrawResult = {
  invoice: string
  amountSats: number
}

export function useArkLnurlWithdraw(accountId: string | null | undefined) {
  const { data: walletReady } = useArkWallet(accountId)

  return useMutation<WithdrawResult, Error, WithdrawInput>({
    mutationFn: async ({ amountSats, details }) => {
      if (!accountId) {
        throw new Error('Ark account is required')
      }
      if (!walletReady) {
        throw new Error('Ark wallet not ready')
      }
      if (!isLnurlWithdrawAmountInRange(amountSats, details)) {
        throw new Error('Amount out of range')
      }
      const invoice = await createArkBolt11Invoice(
        getArkAccountOrThrow(accountId).serverId,
        accountId,
        amountSats,
        details.defaultDescription
      )
      await requestLNURLWithdrawInvoice(
        details.callback,
        amountSats * MILLISATS_PER_SAT,
        details.k1,
        details.defaultDescription,
        invoice.invoice
      )
      return { amountSats, invoice: invoice.invoice }
    }
  })
}
