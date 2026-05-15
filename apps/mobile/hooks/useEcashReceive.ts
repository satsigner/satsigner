import { getDecodedToken } from '@cashu/cashu-ts'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner-native'

import { useEcash, useQuotePolling } from '@/hooks/useEcash'
import { t } from '@/locales'
import type { EcashMint, EcashToken } from '@/types/models/Ecash'
import type { LNURLWithdrawDetails } from '@/types/models/LNURL'
import { prepareEcashTokenInput } from '@/utils/contentDetector'
import {
  decodeLNURL,
  fetchLNURLWithdrawDetails,
  getLNURLType,
  requestLNURLWithdrawInvoice
} from '@/utils/lnurl'

const POLL_START_DELAY_MS = 2000

function normalizeMintUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase()
}

type TokenSpentStatus = 'unknown' | 'checking' | 'unspent' | 'spent' | 'error'

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
  const [tokenSpentStatus, setTokenSpentStatus] =
    useState<TokenSpentStatus>('unknown')

  const {
    activeAccountId,
    mints,
    proofs,
    receiveEcash,
    createMintQuote,
    checkMintQuote,
    mintProofs,
    checkTokenStatus,
    connectToMint
  } = useEcash()
  const [isAddingMint, setIsAddingMint] = useState(false)
  const [selectedMintUrlForLightning, setSelectedMintUrlForLightning] =
    useState<string | null>(null)
  const selectedMintForLightning =
    mints.find((m) => m.url === selectedMintUrlForLightning) ?? mints[0] ?? null

  function setSelectedMintForLightning(mint: EcashMint) {
    setSelectedMintUrlForLightning(mint.url)
  }
  const { isPolling, startPolling, stopPolling } = useQuotePolling()

  // checkTokenStatus is recreated on every useEcash render, so mirror it into
  // a ref to avoid re-running the spent-state effect on identity changes.
  const checkTokenStatusRef = useRef(checkTokenStatus)
  useEffect(() => {
    checkTokenStatusRef.current = checkTokenStatus
  }, [checkTokenStatus])

  // Compute whether the decoded token's mint matches one of the user's
  // connected mints. We normalize to absorb trailing-slash / casing variance
  // between mint metadata and the stored mint list.
  const connectedMintUrls = mints.map((m) => normalizeMintUrl(m.url))
  const tokenMintUrl = decodedToken?.mint ?? ''
  const isTokenMintConnected =
    !!tokenMintUrl && connectedMintUrls.includes(normalizeMintUrl(tokenMintUrl))

  // Proactively check if the decoded token has already been claimed so we can
  // warn the user *before* they press redeem (instead of failing silently at
  // the mint). Only runs when we have a matching connected mint — otherwise
  // we cannot ask the mint for proof state.
  useEffect(() => {
    if (!token || !decodedToken || !isTokenMintConnected) {
      setTokenSpentStatus('unknown')
      return
    }

    let cancelled = false
    setTokenSpentStatus('checking')

    async function runCheck() {
      try {
        const result = await checkTokenStatusRef.current(
          token,
          decodedToken!.mint
        )
        if (cancelled) {
          return
        }
        if (result.isSpent) {
          setTokenSpentStatus('spent')
        } else if (result.isValid) {
          setTokenSpentStatus('unspent')
        } else {
          setTokenSpentStatus('error')
        }
      } catch {
        if (!cancelled) {
          setTokenSpentStatus('error')
        }
      }
    }

    runCheck()

    return () => {
      cancelled = true
    }
  }, [token, decodedToken, isTokenMintConnected])

  function handleTokenChange(text: string) {
    const normalized = prepareEcashTokenInput(text)
    setToken(normalized)
    setDecodedToken(null)

    if (!normalized || !normalized.toLowerCase().startsWith('cashu')) {
      return
    }
    try {
      const decoded = getDecodedToken(normalized)
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

    if (!tokenMintUrl) {
      toast.error(t('ecash.error.noMintConnected'))
      return
    }

    if (tokenSpentStatus === 'spent') {
      toast.error(t('ecash.error.tokenAlreadyClaimed'))
      return
    }

    setIsRedeeming(true)
    try {
      await receiveEcash(tokenMintUrl, token)
      setToken('')
      setTokenSpentStatus('unknown')
      if (activeAccountId) {
        router.navigate(`/signer/ecash/account/${activeAccountId}`)
      } else {
        router.navigate('/signer/ecash')
      }
    } catch {
      // useEcash.receiveEcashHandler already toasts a localized message.
      // Re-probe the mint so the UI surfaces an 'already claimed' banner when
      // the failure really was a double-spend (and not a transient network
      // issue), covering the race where the token gets claimed elsewhere
      // between our initial check and the redeem attempt.
      if (decodedToken) {
        try {
          const status = await checkTokenStatusRef.current(
            token,
            decodedToken.mint
          )
          if (status.isSpent) {
            setTokenSpentStatus('spent')
          }
        } catch {
          // Ignore; we already surfaced an error to the user.
        }
      }
    } finally {
      setIsRedeeming(false)
    }
  }

  async function createInvoice() {
    if (!amount) {
      toast.error(t('ecash.error.invalidAmount'))
      return
    }

    if (!selectedMintForLightning) {
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

      const mintUrl = selectedMintForLightning.url
      const quote = await createMintQuote(mintUrl, amountSats, memo)
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
          const reason = error instanceof Error ? error.message : 'unknown'
          toast.error(
            `${t('ecash.error.failedToRequestLnurlWithdraw')}: ${reason}`
          )
        }
      }

      setTimeout(() => {
        startPolling(async () => {
          if (!mintUrl || !quote) {
            return false
          }

          try {
            const status = await checkMintQuote(mintUrl, quote.quote)
            setQuoteStatus(status)

            if (status === 'PAID' || status === 'ISSUED') {
              await mintProofs(mintUrl, amountSats, quote.quote)
              setMintQuote(null)
              setAmount('')
              setMemo('')
              setLnurlWithdrawCode(null)
              setLnurlWithdrawDetails(null)
              setIsLNURLWithdrawMode(false)
              stopPolling()
              toast.success(t('ecash.success.paymentReceived'))
              if (activeAccountId) {
                router.navigate(`/signer/ecash/account/${activeAccountId}`)
              } else {
                router.navigate('/signer/ecash')
              }
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

  async function addTokenMint() {
    if (!tokenMintUrl) {
      return
    }
    setIsAddingMint(true)
    try {
      await connectToMint(tokenMintUrl)
    } catch {
      // Error handling is done in connectToMint
    } finally {
      setIsAddingMint(false)
    }
  }

  return {
    addTokenMint,
    amount,
    createInvoice,
    decodedToken,
    handleLNURLWithdrawInput,
    handleTokenChange,
    isAddingMint,
    isCreatingQuote,
    isFetchingLNURL,
    isLNURLWithdrawMode,
    isPolling,
    isRedeeming,
    isTokenMintConnected,
    lnurlWithdrawDetails,
    memo,
    mintQuote,
    mints,
    proofs,
    quoteStatus,
    redeemToken,
    resetLNURLState,
    selectedMintForLightning,
    setAmount,
    setMemo,
    setSelectedMintForLightning,
    stopPolling,
    token,
    tokenMintUrl,
    tokenSpentStatus
  }
}
