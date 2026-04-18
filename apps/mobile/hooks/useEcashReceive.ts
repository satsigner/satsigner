import { getDecodedToken } from '@cashu/cashu-ts'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { toast } from 'sonner-native'

import { useEcash, useQuotePolling } from '@/hooks/useEcash'
import { t } from '@/locales'
import type { EcashToken } from '@/types/models/Ecash'
import type { LNURLWithdrawDetails } from '@/types/models/LNURL'
import {
  decodeLNURL,
  fetchLNURLWithdrawDetails,
  getLNURLType,
  requestLNURLWithdrawInvoice
} from '@/utils/lnurl'

const POLL_START_DELAY_MS = 2000

export function useEcashReceive() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [decodedToken, setDecodedToken] = useState<EcashToken | null>(null)
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [mintQuote, setMintQuote] = useState<{
    request: string
    quote: string
    expiry: number
  } | null>(null)
  const [quoteStatus, setQuoteStatus] = useState<string>('')
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [isCreatingQuote, setIsCreatingQuote] = useState(false)
  const [lnurlWithdrawCode, setLnurlWithdrawCode] = useState<string | null>(
    null
  )
  const [lnurlWithdrawDetails, setLnurlWithdrawDetails] =
    useState<LNURLWithdrawDetails | null>(null)
  const [isLNURLWithdrawMode, setIsLNURLWithdrawMode] = useState(false)
  const [isFetchingLNURL, setIsFetchingLNURL] = useState(false)

  const { mints, receiveEcash, createMintQuote, checkMintQuote, mintProofs } =
    useEcash()
  const activeMint = mints[0] ?? null
  const { isPolling, startPolling, stopPolling } = useQuotePolling()

  function handleTokenChange(text: string) {
    setToken(text)
    setDecodedToken(null)

    const cleanText = text.trim()
    if (!cleanText || !cleanText.toLowerCase().startsWith('cashu')) {
      return
    }
    try {
      const decoded = getDecodedToken(cleanText)
      setDecodedToken(decoded as EcashToken)
    } catch {
      setDecodedToken(null)
    }
  }

  async function handleLNURLWithdrawInput(input: string) {
    const cleanInput = input.trim()
    if (!cleanInput) {
      return
    }

    const { isLNURL: isLNURLInput, type: lnurlType } = getLNURLType(cleanInput)

    if (!isLNURLInput || lnurlType !== 'withdraw') {
      toast.error(t('ecash.error.invalidLnurlType'))
      return
    }

    setIsFetchingLNURL(true)
    setIsLNURLWithdrawMode(true)
    setLnurlWithdrawCode(cleanInput)

    try {
      const url = decodeLNURL(cleanInput)
      const details = await fetchLNURLWithdrawDetails(url)
      setLnurlWithdrawDetails(details)
      setAmount(Math.floor(details.maxWithdrawable / 1000).toString())
      toast.success(t('ecash.success.lnurlWithdrawDetected'))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('ecash.error.failedToFetchLnurlDetails')
      )
      setIsLNURLWithdrawMode(false)
      setLnurlWithdrawCode(null)
      setLnurlWithdrawDetails(null)
    } finally {
      setIsFetchingLNURL(false)
    }
  }

  async function redeemToken() {
    if (!token) {
      toast.error(t('ecash.error.invalidToken'))
      return
    }

    if (!activeMint) {
      toast.error(t('ecash.error.noMintConnected'))
      return
    }

    setIsRedeeming(true)
    try {
      await receiveEcash(activeMint.url, token)
      setToken('')
      router.navigate('/signer/ecash')
    } catch {
      // Error handling is done in the hook
    } finally {
      setIsRedeeming(false)
    }
  }

  async function createInvoice() {
    if (!amount) {
      toast.error(t('ecash.error.invalidAmount'))
      return
    }

    if (!activeMint) {
      toast.error(t('ecash.error.noMintConnected'))
      return
    }

    setIsCreatingQuote(true)
    try {
      const amountSats = parseInt(amount, 10)

      if (isLNURLWithdrawMode && lnurlWithdrawDetails) {
        const amountMillisats = amountSats * 1000
        if (
          amountMillisats < lnurlWithdrawDetails.minWithdrawable ||
          amountMillisats > lnurlWithdrawDetails.maxWithdrawable
        ) {
          toast.error(
            t('ecash.error.amountOutOfRange', {
              max: Math.floor(
                lnurlWithdrawDetails.maxWithdrawable / 1000
              ).toString(),
              min: Math.ceil(
                lnurlWithdrawDetails.minWithdrawable / 1000
              ).toString()
            })
          )
          setIsCreatingQuote(false)
          return
        }
      }

      const quote = await createMintQuote(activeMint.url, amountSats, memo)
      setMintQuote(quote)
      setQuoteStatus('PENDING')
      toast.success(t('ecash.success.invoiceCreated'))

      if (isLNURLWithdrawMode && lnurlWithdrawDetails && lnurlWithdrawCode) {
        try {
          await requestLNURLWithdrawInvoice(
            lnurlWithdrawDetails.callback,
            amountSats * 1000,
            lnurlWithdrawDetails.k1,
            memo || lnurlWithdrawDetails.defaultDescription,
            quote.request
          )
          toast.success(t('ecash.success.lnurlWithdrawRequested'))
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : t('ecash.error.failedToRequestLnurlWithdraw')
          )
        }
      }

      setTimeout(() => {
        startPolling(async () => {
          if (!activeMint || !quote) {
            return false
          }

          try {
            const status = await checkMintQuote(activeMint.url, quote.quote)
            setQuoteStatus(status)

            if (status === 'PAID' || status === 'ISSUED') {
              await mintProofs(activeMint.url, amountSats, quote.quote)
              setMintQuote(null)
              setAmount('')
              setMemo('')
              setLnurlWithdrawCode(null)
              setLnurlWithdrawDetails(null)
              setIsLNURLWithdrawMode(false)
              stopPolling()
              toast.success(t('ecash.success.paymentReceived'))
              router.navigate('/signer/ecash')
              return true
            } else if (status === 'EXPIRED' || status === 'CANCELLED') {
              stopPolling()
              toast.error(t('ecash.error.paymentFailed'))
              return true
            }
            return false
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : t('ecash.error.networkError')
            )
            return false
          }
        })
      }, POLL_START_DELAY_MS)
    } catch {
      // Error handling is done in the hook
    } finally {
      setIsCreatingQuote(false)
    }
  }

  function resetLNURLState() {
    setLnurlWithdrawCode(null)
    setLnurlWithdrawDetails(null)
    setIsLNURLWithdrawMode(false)
  }

  return {
    activeMint,
    amount,
    createInvoice,
    decodedToken,
    handleLNURLWithdrawInput,
    handleTokenChange,
    isCreatingQuote,
    isFetchingLNURL,
    isLNURLWithdrawMode,
    isPolling,
    isRedeeming,
    lnurlWithdrawDetails,
    memo,
    mintQuote,
    quoteStatus,
    redeemToken,
    resetLNURLState,
    setAmount,
    setMemo,
    stopPolling,
    token
  }
}
