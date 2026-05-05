import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { toast } from 'sonner-native'

import { useEcash } from '@/hooks/useEcash'
import { useLND } from '@/hooks/useLND'
import { useNFCEmitter } from '@/hooks/useNFCEmitter'
import { t } from '@/locales'
import { useZapFlowStore } from '@/store/zapFlow'
import type { EcashMint } from '@/types/models/Ecash'
import type { LNDecodedInvoice } from '@/types/models/LND'
import type { LNURLPayResponse } from '@/types/models/LNURL'
import {
  decodeLightningInvoice,
  isLightningInvoice
} from '@/utils/lightningInvoiceDecoder'
import {
  decodeLNURL,
  fetchLNURLPayDetails,
  getLNURLType,
  handleLNURLPay
} from '@/utils/lnurl'
import { getURBytesFragments } from '@/utils/ur'

const ANIMATED_QR_FRAGMENT_SIZE = 200
const ANIMATED_QR_INTERVAL_MS = 500
const NFC_MAX_SIZE = 8192
const LNURL_PAY_DELAY_MS = 1000

export function useEcashSend() {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [comment, setComment] = useState('')
  const [invoice, setInvoice] = useState('')
  const [generatedTokenV4, setGeneratedTokenV4] = useState('')
  const [generatedTokenV3, setGeneratedTokenV3] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isMelting, setIsMelting] = useState(false)
  const [decodedInvoice, setDecodedInvoice] = useState<LNDecodedInvoice | null>(
    null
  )
  const [isLNURLMode, setIsLNURLMode] = useState(false)
  const [lnurlDetails, setLNURLDetails] = useState<LNURLPayResponse | null>(
    null
  )
  const [isFetchingLNURL, setIsFetchingLNURL] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [showQRCode, setShowQRCode] = useState(false)
  const [animatedQR, setAnimatedQR] = useState(false)
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0)
  const [tokenVersion, setTokenVersion] = useState<'v3' | 'v4'>('v4')
  const animationRef = useRef<number | null>(null)
  const lastUpdateRef = useRef<number>(0)

  const {
    activeAccount,
    mints,
    sendEcash,
    createMeltQuote,
    meltProofs,
    proofs
  } = useEcash()
  const [selectedMintUrl, setSelectedMintUrl] = useState<string | null>(null)
  const selectedMint =
    mints.find((m) => m.url === selectedMintUrl) ?? mints[0] ?? null
  const mintProofs = proofs.filter((p) => p.mintUrl === selectedMint?.url)

  function setSelectedMint(mint: EcashMint) {
    setSelectedMintUrl(mint.url)
  }
  const { makeRequest, isConnected } = useLND()
  const {
    isHardwareSupported: nfcHardwareSupported,
    isEmitting,
    emitNFCTag
  } = useNFCEmitter()

  async function generateToken() {
    if (!amount || amount.trim() === '') {
      toast.error(t('ecash.error.invalidAmount'))
      return
    }

    const amountNum = parseInt(amount, 10)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error(t('ecash.error.invalidAmount'))
      return
    }

    if (!selectedMint) {
      toast.error(t('ecash.error.noMintConnected'))
      return
    }

    if (mintProofs.length === 0) {
      toast.error(t('ecash.error.noTokensToSend'))
      return
    }

    setIsGenerating(true)
    setGeneratedTokenV4('')
    setGeneratedTokenV3('')
    try {
      const result = await sendEcash(selectedMint.url, amountNum, memo)
      setGeneratedTokenV4(result.token)
      setGeneratedTokenV3(result.tokenV3)
    } catch {
      // Error handling is done in the hook
    } finally {
      setIsGenerating(false)
    }
  }

  const generatedToken =
    tokenVersion === 'v3' ? generatedTokenV3 : generatedTokenV4

  async function meltTokens() {
    if (!invoice) {
      toast.error(t('ecash.error.invalidInvoice'))
      setStatusMessage(`Error: ${t('ecash.error.noInvoiceProvided')}`)
      return
    }

    if (!selectedMint) {
      toast.error(t('ecash.error.noMintConnected'))
      setStatusMessage(`Error: ${t('ecash.error.noMintConnected')}`)
      return
    }

    if (mintProofs.length === 0) {
      toast.error(t('ecash.error.noTokensToMelt'))
      setStatusMessage(`Error: ${t('ecash.error.noTokensAvailable')}`)
      return
    }

    setIsMelting(true)
    setStatusMessage(t('ecash.status.startingMeltProcess'))
    try {
      const bolt11Invoice = await resolveBolt11Invoice()
      if (!bolt11Invoice) {
        return
      }

      setStatusMessage(t('ecash.status.creatingMeltQuote'))
      const quote = await createMeltQuote(selectedMint.url, bolt11Invoice)
      setStatusMessage(t('ecash.status.meltQuoteCreated'))

      await meltProofs(
        selectedMint.url,
        quote,
        mintProofs,
        decodedInvoice?.description,
        bolt11Invoice
      )
      setStatusMessage(t('ecash.status.tokensMeltedSuccessfully'))

      setInvoice('')
      setAmount('')
      toast.success(t('ecash.success.tokensMelted'))
      const { pendingZap, setZapResult } = useZapFlowStore.getState()
      if (pendingZap) {
        setZapResult('success')
        router.back()
      } else {
        router.navigate('/signer/ecash')
      }
    } catch (error) {
      handleMeltError(error)
    } finally {
      setIsMelting(false)
    }
  }

  async function resolveBolt11Invoice(): Promise<string | null> {
    if (isLNURLMode && lnurlDetails) {
      if (!amount) {
        toast.error(t('ecash.error.pleaseEnterAmount'))
        setStatusMessage(`Error: ${t('ecash.error.noAmountEntered')}`)
        return null
      }

      const amountSats = parseInt(amount, 10)
      if (isNaN(amountSats) || amountSats <= 0) {
        toast.error(t('ecash.error.pleaseEnterValidAmount'))
        setStatusMessage(`Error: ${t('ecash.error.pleaseEnterValidAmount')}`)
        return null
      }

      setStatusMessage(t('ecash.status.requestingLnurlInvoice'))
      const bolt11 = await handleLNURLPay(
        invoice,
        amountSats,
        comment || undefined
      )
      setStatusMessage(t('ecash.status.lnurlInvoiceReceived'))

      await new Promise((resolve) => {
        setTimeout(resolve, LNURL_PAY_DELAY_MS)
      })
      return bolt11
    }

    setStatusMessage(t('ecash.status.usingBolt11Invoice'))
    return invoice
  }

  function handleMeltError(error: unknown) {
    if (!(error instanceof Error)) {
      setStatusMessage(`Error: ${t('ecash.error.unknownError')}`)
      toast.error(t('ecash.error.lnurlPaymentFailed'))
      return
    }

    const msg = error.message
    if (msg.includes('404') || msg.includes('Not Found')) {
      setStatusMessage(`Error: ${t('ecash.error.paymentRequestExpired')}`)
      toast.error(t('ecash.error.paymentRequestExpiredMessage'))
    } else if (msg.includes('amount')) {
      setStatusMessage(`Error: ${msg}`)
      toast.error(msg)
    } else if (msg.includes('no_route')) {
      setStatusMessage(`Error: ${t('ecash.error.noPaymentRoute')}`)
      toast.error(t('ecash.error.noPaymentRouteMessage'))
    } else if (msg.includes('insufficient_balance')) {
      setStatusMessage(`Error: ${t('ecash.error.insufficientBalance')}`)
      toast.error(t('ecash.error.insufficientBalance'))
    } else if (msg.includes('payment_failed')) {
      setStatusMessage(
        `Error: ${t('ecash.error.lightningPaymentFailedStatus')}`
      )
      toast.error(t('ecash.error.lightningPaymentFailed'))
    } else if (msg.includes('melt proofs')) {
      const specificError =
        msg.split(': ').pop() || t('ecash.error.unknownMeltError')
      setStatusMessage(`Error: ${specificError}`)
      toast.error(`${t('ecash.error.meltFailed')}: ${specificError}`)
    } else {
      setStatusMessage(`Error: ${msg}`)
      toast.error(msg)
    }
  }

  async function handleInvoiceChange(text: string) {
    setInvoice(text)
    setDecodedInvoice(null)
    setLNURLDetails(null)

    const cleanText = text.trim()
    if (!cleanText) {
      return
    }

    const { isLNURL: isLNURLInput, type: lnurlType } = getLNURLType(cleanText)
    if (isLNURLInput && lnurlType === 'pay') {
      setIsLNURLMode(true)
      setIsFetchingLNURL(true)
      try {
        const url = decodeLNURL(cleanText)
        const details = await fetchLNURLPayDetails(url)
        setLNURLDetails(details)
        if (details.minSendable) {
          setAmount(Math.ceil(details.minSendable / 1000).toString())
        }
      } catch {
        setLNURLDetails(null)
      } finally {
        setIsFetchingLNURL(false)
      }
      return
    }

    if (isLNURLInput && lnurlType === 'withdraw') {
      toast.error(t('ecash.error.lnurlWithdrawInSendTab'))
      return
    }

    if (!isLightningInvoice(cleanText)) {
      setIsLNURLMode(false)
      return
    }

    setIsLNURLMode(false)

    try {
      const decoded = decodeLightningInvoice(cleanText)
      setDecodedInvoice(decoded)
      if (decoded.num_satoshis) {
        setAmount(decoded.num_satoshis)
      }
    } catch {
      if (!isConnected) {
        setDecodedInvoice(null)
        toast.warning(t('ecash.error.invoiceDecodeFailed'))
        return
      }
      try {
        const lndDecoded = await makeRequest<LNDecodedInvoice>(
          `/v1/payreq/${cleanText}`
        )
        setDecodedInvoice(lndDecoded)
        if (lndDecoded.num_satoshis) {
          setAmount(lndDecoded.num_satoshis)
        }
      } catch {
        setDecodedInvoice(null)
        toast.warning(t('ecash.error.invoiceDecodeFailed'))
      }
    }
  }

  async function emitNFC() {
    if (!generatedToken) {
      toast.error(t('ecash.error.noTokenToEmit'))
      return
    }

    if (!nfcHardwareSupported) {
      toast.error(t('ecash.error.nfcNotAvailable'))
      return
    }

    try {
      await emitNFCTag(generatedToken)
      if (generatedToken.length > NFC_MAX_SIZE) {
        toast.warning(t('ecash.warning.tokenTruncated'))
      } else {
        toast.success(t('ecash.success.tokenEmitted'))
      }
    } catch {
      toast.error(t('ecash.error.nfcEmissionFailed'))
    }
  }

  function getTokenURFragments(
    fragmentSize = ANIMATED_QR_FRAGMENT_SIZE
  ): string[] {
    if (!generatedToken) {
      return []
    }
    try {
      return getURBytesFragments(generatedToken, fragmentSize)
    } catch {
      // Fall back to the raw token as a single static QR if UR encoding
      // fails for any reason. This preserves the copy/NFC path.
      return [generatedToken]
    }
  }

  function getQRValue(chunks: string[]): string {
    if (!generatedToken) {
      return ''
    }
    if (animatedQR && chunks.length > 1) {
      return chunks[currentChunkIndex % chunks.length] ?? generatedToken
    }
    return generatedToken
  }

  return {
    activeAccount,
    amount,
    animatedQR,
    animationRef,
    comment,
    currentChunkIndex,
    decodedInvoice,
    emitNFC,
    generateToken,
    generatedToken,
    getQRValue,
    getTokenURFragments,
    handleInvoiceChange,
    invoice,
    isEmitting,
    isFetchingLNURL,
    isGenerating,
    isLNURLMode,
    isMelting,
    lastUpdateRef,
    lnurlDetails,
    meltTokens,
    memo,
    mintProofs,
    mints,
    nfcHardwareSupported,
    proofs,
    selectedMint,
    setAmount,
    setAnimatedQR,
    setComment,
    setCurrentChunkIndex,
    setMemo,
    setSelectedMint,
    setShowQRCode,
    setTokenVersion,
    showQRCode,
    statusMessage,
    tokenVersion
  }
}

export { ANIMATED_QR_INTERVAL_MS }
