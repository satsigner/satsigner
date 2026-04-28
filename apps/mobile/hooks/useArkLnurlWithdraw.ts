import { useMutation, useQuery } from '@tanstack/react-query'

import { createArkBolt11Invoice } from '@/api/ark'
import { useArkStore } from '@/store/ark'
import type { LNURLWithdrawDetails } from '@/types/models/LNURL'
import {
  decodeLNURL,
  fetchLNURLWithdrawDetails,
  isLNURL,
  requestLNURLWithdrawInvoice
} from '@/utils/lnurl'

import { useArkWallet } from './useArkWallet'

const LNURL_DETAILS_STALE_MS = 60_000

function getAccountServerId(accountId: string) {
  const { accounts } = useArkStore.getState()
  const account = accounts.find((a) => a.id === accountId)
  if (!account) {
    throw new Error('Ark account not found')
  }
  return account.serverId
}

function resolveLnurlUrl(raw: string): string {
  const cleaned = raw.trim().replace(/^lightning:/i, '')
  return isLNURL(cleaned) ? decodeLNURL(cleaned) : cleaned
}

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
    staleTime: LNURL_DETAILS_STALE_MS
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
      const amountMillisats = amountSats * 1000
      if (
        amountMillisats < details.minWithdrawable ||
        amountMillisats > details.maxWithdrawable
      ) {
        throw new Error('Amount out of range')
      }
      const invoice = await createArkBolt11Invoice(
        getAccountServerId(accountId),
        accountId,
        amountSats,
        details.defaultDescription
      )
      await requestLNURLWithdrawInvoice(
        details.callback,
        amountMillisats,
        details.k1,
        details.defaultDescription,
        invoice.invoice
      )
      return { amountSats, invoice: invoice.invoice }
    }
  })
}
