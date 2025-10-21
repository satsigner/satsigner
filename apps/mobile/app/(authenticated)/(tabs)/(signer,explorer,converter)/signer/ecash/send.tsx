import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSAmountInput from '@/components/SSAmountInput'
import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSLNURLDetails from '@/components/SSLNURLDetails'
import SSModal from '@/components/SSModal'
import SSPaymentDetails from '@/components/SSPaymentDetails'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useEcash } from '@/hooks/useEcash'
import { useLND } from '@/hooks/useLND'
import { useNFCEmitter } from '@/hooks/useNFCEmitter'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { type DecodedInvoice } from '@/types/lightning'
import { type DetectedContent } from '@/utils/contentDetector'
import {
  decodeLightningInvoice,
  isLightningInvoice
} from '@/utils/lightningInvoiceDecoder'
import {
  decodeLNURL,
  fetchLNURLPayDetails,
  handleLNURLPay,
  isLNURL
} from '@/utils/lnurl'

type MakeRequest = <T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: unknown
    headers?: Record<string, string>
  }
) => Promise<T>

type LNURLPayResponse = {
  callback: string
  maxSendable: number
  minSendable: number
  metadata: string
  tag: 'payRequest'
  commentAllowed?: number
  nostrPubkey?: string
  allowsNostr?: boolean
}

export default function EcashSendPage() {
  const { invoice: invoiceParam } = useLocalSearchParams()
  const [activeTab, setActiveTab] = useState<'ecash' | 'lightning'>('ecash')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [comment, setComment] = useState('')
  const [invoice, setInvoice] = useState('')
  const [generatedToken, setGeneratedToken] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isMelting, setIsMelting] = useState(false)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [decodedInvoice, setDecodedInvoice] = useState<DecodedInvoice | null>(
    null
  )
  const [isLNURLMode, setIsLNURLMode] = useState(false)
  const [lnurlDetails, setLNURLDetails] = useState<LNURLPayResponse | null>(
    null
  )
  const [isFetchingLNURL, setIsFetchingLNURL] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [showQRCode, setShowQRCode] = useState(false)

  const { activeMint, sendEcash, createMeltQuote, meltProofs, proofs } =
    useEcash()
  const { makeRequest, isConnected, verifyConnection } = useLND()
  const { isAvailable: nfcAvailable, isEmitting, emitNFCTag } = useNFCEmitter()
  const typedMakeRequest = makeRequest as MakeRequest
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )

  const handleGenerateToken = useCallback(async () => {
    if (!amount || amount.trim() === '') {
      toast.error(t('ecash.error.invalidAmount'))
      return
    }

    const amountNum = parseInt(amount, 10)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error(t('ecash.error.invalidAmount'))
      return
    }

    if (!activeMint) {
      toast.error(t('ecash.error.noMintConnected'))
      return
    }

    if (proofs.length === 0) {
      toast.error(t('ecash.error.noTokensToSend'))
      return
    }

    setIsGenerating(true)
    setGeneratedToken('')
    try {
      const result = await sendEcash(activeMint.url, amountNum, memo)
      setGeneratedToken(result.token)
    } catch {
      // Error handling is done in the hook
    } finally {
      setIsGenerating(false)
    }
  }, [amount, memo, activeMint, sendEcash, proofs])

  const handleMeltTokens = useCallback(async () => {
    if (!invoice) {
      toast.error(t('ecash.error.invalidInvoice'))
      setStatusMessage(`Error: ${t('ecash.error.noInvoiceProvided')}`)
      return
    }

    if (!activeMint) {
      toast.error(t('ecash.error.noMintConnected'))
      setStatusMessage(`Error: ${t('ecash.error.noMintConnected')}`)
      return
    }

    if (proofs.length === 0) {
      toast.error(t('ecash.error.noTokensToMelt'))
      setStatusMessage(`Error: ${t('ecash.error.noTokensAvailable')}`)
      return
    }

    setIsMelting(true)
    setStatusMessage(t('ecash.status.startingMeltProcess'))
    try {
      let bolt11Invoice: string

      if (isLNURLMode && lnurlDetails) {
        // For LNURL-pay, create bolt11 invoice first
        if (!amount) {
          toast.error(t('ecash.error.pleaseEnterAmount'))
          setStatusMessage(`Error: ${t('ecash.error.noAmountEntered')}`)
          return
        }

        const amountSats = parseInt(amount, 10)
        if (isNaN(amountSats) || amountSats <= 0) {
          toast.error(t('ecash.error.pleaseEnterValidAmount'))
          setStatusMessage(`Error: ${t('ecash.error.pleaseEnterValidAmount')}`)
          return
        }

        // Use existing LNURL-pay flow to get bolt11 invoice
        setStatusMessage(t('ecash.status.requestingLnurlInvoice'))
        bolt11Invoice = await handleLNURLPay(
          invoice,
          amountSats,
          comment || undefined
        )
        setStatusMessage(t('ecash.status.lnurlInvoiceReceived'))

        // Small delay to ensure invoice is properly registered
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } else {
        // For bolt11, use invoice directly
        setStatusMessage(t('ecash.status.usingBolt11Invoice'))
        bolt11Invoice = invoice
      }

      // Use existing melt logic with the bolt11 invoice
      setStatusMessage(t('ecash.status.creatingMeltQuote'))
      const quote = await createMeltQuote(activeMint.url, bolt11Invoice)
      setStatusMessage(t('ecash.status.meltQuoteCreated'))

      await meltProofs(
        activeMint.url,
        quote,
        proofs,
        decodedInvoice?.description
      )
      setStatusMessage(t('ecash.status.tokensMeltedSuccessfully'))

      setInvoice('')
      setAmount('')
      toast.success(t('ecash.success.tokensMelted'))
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes('404') ||
          error.message.includes('Not Found')
        ) {
          setStatusMessage(`Error: ${t('ecash.error.paymentRequestExpired')}`)
          toast.error(t('ecash.error.paymentRequestExpiredMessage'))
        } else if (error.message.includes('amount')) {
          setStatusMessage(`Error: ${error.message}`)
          toast.error(error.message)
        } else if (error.message.includes('no_route')) {
          setStatusMessage(`Error: ${t('ecash.error.noPaymentRoute')}`)
          toast.error(t('ecash.error.noPaymentRouteMessage'))
        } else if (error.message.includes('insufficient_balance')) {
          setStatusMessage(`Error: ${t('ecash.error.insufficientBalance')}`)
          toast.error(t('ecash.error.insufficientBalance'))
        } else if (error.message.includes('payment_failed')) {
          setStatusMessage(
            `Error: ${t('ecash.error.lightningPaymentFailedStatus')}`
          )
          toast.error(t('ecash.error.lightningPaymentFailed'))
        } else if (error.message.includes('melt proofs')) {
          // Extract the specific error from the melt proofs error
          const specificError =
            error.message.split(': ').pop() || t('ecash.error.unknownMeltError')
          setStatusMessage(`Error: ${specificError}`)
          toast.error(`${t('ecash.error.meltFailed')}: ${specificError}`)
        } else {
          setStatusMessage(`Error: ${error.message}`)
          toast.error(error.message)
        }
      } else {
        setStatusMessage(`Error: ${t('ecash.error.unknownError')}`)
        toast.error(t('ecash.error.lnurlPaymentFailed'))
      }
    } finally {
      setIsMelting(false)
    }
  }, [
    invoice,
    activeMint,
    createMeltQuote,
    meltProofs,
    proofs,
    isLNURLMode,
    lnurlDetails,
    amount,
    comment,
    decodedInvoice?.description
  ])

  const decodeInvoice = useCallback(
    async (invoice: string) => {
      try {
        const response = await typedMakeRequest<DecodedInvoice>(
          '/v1/payreq/' + invoice
        )
        setDecodedInvoice(response)
        return response
      } catch {
        setDecodedInvoice(null)
        throw new Error('Failed to decode invoice')
      }
    },
    [typedMakeRequest]
  )

  const handleInvoiceChange = useCallback(
    async (text: string) => {
      setInvoice(text)
      setDecodedInvoice(null) // Clear previous decode
      setLNURLDetails(null) // Clear previous LNURL details

      // Clean the text and check if it's a valid invoice
      const cleanText = text.trim()
      if (!cleanText) return

      // Check if it's LNURL-pay
      if (isLNURL(cleanText)) {
        setIsLNURLMode(true)
        setIsFetchingLNURL(true)
        try {
          const url = decodeLNURL(cleanText)
          const details = await fetchLNURLPayDetails(url)
          setLNURLDetails(details)
          // Auto-set minimum amount
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

      // Check if it's bolt11 invoice
      if (isLightningInvoice(cleanText)) {
        setIsLNURLMode(false)

        // For ecash, we don't need LND connection to process Lightning invoices
        // The ecash mint will handle the Lightning payment
        // Use bolt11-decode for user transparency (works without LND)
        try {
          // Try lightweight decoder first (always works)
          const decoded = decodeLightningInvoice(cleanText)
          setDecodedInvoice(decoded)

          // Auto-populate amount from decoded invoice
          if (decoded.num_satoshis) {
            setAmount(decoded.num_satoshis)
          }
        } catch (bolt11Error) {
          // Fallback to LND decoder if available
          if (isConnected) {
            try {
              const lndDecoded = await decodeInvoice(cleanText)
              setDecodedInvoice(lndDecoded)
              if (lndDecoded.num_satoshis) {
                setAmount(lndDecoded.num_satoshis)
              }
            } catch (lndError) {
              setDecodedInvoice(null)
              toast.warning(t('ecash.error.invoiceDecodeFailed'))
            }
          } else {
            setDecodedInvoice(null)
            toast.warning(t('ecash.error.invoiceDecodeFailed'))
          }
        }
      } else {
        setIsLNURLMode(false)
      }
    },
    [isConnected, decodeInvoice]
  )

  useEffect(() => {
    if (invoiceParam) {
      const invoiceValue = Array.isArray(invoiceParam)
        ? invoiceParam[0]
        : invoiceParam
      if (invoiceValue) {
        setInvoice(invoiceValue)
        setActiveTab('lightning')
        // Process the invoice to detect if it's LNURL or bolt11
        handleInvoiceChange(invoiceValue)
      }
    }
  }, [invoiceParam, handleInvoiceChange])

  const handlePasteInvoice = useCallback(async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync()
      if (clipboardText) {
        await handleInvoiceChange(clipboardText)
        toast.success(t('ecash.success.invoicePasted'))
      } else {
        toast.error(t('ecash.error.noTextInClipboard'))
      }
    } catch {
      toast.error(t('ecash.error.failedToPaste'))
    }
  }, [handleInvoiceChange])

  const handleScanInvoice = useCallback(() => {
    setCameraModalVisible(true)
  }, [])

  const handleContentScanned = useCallback(
    (content: DetectedContent) => {
      setCameraModalVisible(false)
      // Clean the data (remove any whitespace and lightning: prefix)
      const cleanData = content.cleaned.replace(/^lightning:/i, '')
      handleInvoiceChange(cleanData)
      toast.success(t('ecash.success.invoiceScanned'))
    },
    [handleInvoiceChange]
  )

  const handleCopyToken = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(generatedToken)
      toast.success(t('common.copiedToClipboard'))
    } catch {
      toast.error(t('ecash.error.failedToCopy'))
    }
  }, [generatedToken])

  const handleToggleQRCode = useCallback(() => {
    setShowQRCode(!showQRCode)
  }, [showQRCode])

  const handleEmitNFC = useCallback(async () => {
    if (!generatedToken) {
      toast.error(t('ecash.error.noTokenToEmit'))
      return
    }

    if (!nfcAvailable) {
      toast.error(t('ecash.error.nfcNotAvailable'))
      return
    }

    try {
      await emitNFCTag(generatedToken)
      // Check if token was truncated due to size limits
      if (generatedToken.length > 8192) {
        toast.warning(t('ecash.warning.tokenTruncated'))
      } else {
        toast.success(t('ecash.success.tokenEmitted'))
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('ecash.error.nfcEmissionFailed')
      toast.error(errorMessage)
    }
  }, [generatedToken, nfcAvailable, emitNFCTag])

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('ecash.send.title')}</SSText>
        }}
      />
      <ScrollView>
        <SSVStack gap="lg" style={{ paddingBottom: 60 }}>
          <SSHStack>
            <SSButton
              label={t('ecash.send.ecashTab')}
              variant={activeTab === 'ecash' ? 'outline' : 'subtle'}
              style={{ flex: 1 }}
              onPress={() => setActiveTab('ecash')}
            />
            <SSButton
              label={t('ecash.send.lightningTab')}
              variant={activeTab === 'lightning' ? 'outline' : 'subtle'}
              style={{ flex: 1 }}
              onPress={() => setActiveTab('lightning')}
            />
          </SSHStack>
          {activeTab === 'ecash' && (
            <SSVStack gap="md">
              <SSVStack gap="xs">
                <SSText size="xs" uppercase>
                  {t('ecash.send.amount')}
                </SSText>
                <SSAmountInput
                  value={parseInt(amount, 10) || 0}
                  onValueChange={(value) => setAmount(value.toString())}
                  min={0}
                  max={proofs.reduce((acc, proof) => acc + proof.amount, 0)}
                  remainingSats={proofs.reduce(
                    (acc, proof) => acc + proof.amount,
                    0
                  )}
                  fiatCurrency={fiatCurrency}
                  satsToFiat={satsToFiat}
                />
              </SSVStack>
              <SSVStack gap="xs">
                <SSText size="xs" uppercase>
                  {t('ecash.send.memo')}
                </SSText>
                <SSTextInput
                  value={memo}
                  onChangeText={setMemo}
                  placeholder={t('ecash.send.memoPlaceholder')}
                  multiline
                />
              </SSVStack>
              <SSButton
                label={t('ecash.send.generateToken')}
                onPress={handleGenerateToken}
                loading={isGenerating}
                variant="gradient"
                gradientType="special"
              />

              {/* Generated Token Display */}
              {generatedToken && (
                <SSVStack gap="xs">
                  <SSText color="muted" size="xs" uppercase>
                    {t('ecash.send.generatedToken')}
                  </SSText>
                  <SSTextInput
                    value={generatedToken}
                    multiline
                    editable={false}
                    style={styles.tokenInput}
                  />
                  <SSVStack gap="sm">
                    <SSHStack gap="sm">
                      <SSButton
                        label={t('common.copy')}
                        onPress={handleCopyToken}
                        variant="subtle"
                        style={{ flex: 1 }}
                      />
                      <SSButton
                        label={
                          showQRCode ? t('common.hide') : t('common.showQR')
                        }
                        onPress={handleToggleQRCode}
                        variant="subtle"
                        style={{ flex: 1 }}
                      />
                    </SSHStack>
                    <SSButton
                      label={t('common.emitNFC')}
                      onPress={handleEmitNFC}
                      variant="subtle"
                      loading={isEmitting}
                      disabled={!nfcAvailable || !generatedToken}
                    />
                  </SSVStack>

                  {/* QR Code Display */}
                  {showQRCode && (
                    <SSVStack gap="xs" itemsCenter>
                      <SSText color="muted" size="xs" uppercase>
                        {t('ecash.send.qrCode')}
                      </SSText>
                      <SSQRCode value={generatedToken} size={300} ecl="H" />
                    </SSVStack>
                  )}
                </SSVStack>
              )}
            </SSVStack>
          )}
          {activeTab === 'lightning' && (
            <SSVStack gap="md">
              <SSVStack gap="sm">
                <SSText uppercase>{t('ecash.send.lightningInvoice')}</SSText>
                <SSTextInput
                  value={invoice}
                  onChangeText={handleInvoiceChange}
                  placeholder={isLNURLMode ? 'lightning:LNURL1...' : 'lnbc...'}
                  multiline
                  style={styles.invoiceInput}
                />

                <SSHStack gap="sm">
                  <SSButton
                    label={t('common.paste')}
                    onPress={handlePasteInvoice}
                    variant="subtle"
                    style={{ flex: 1 }}
                  />
                  <SSButton
                    label={t('common.scan')}
                    onPress={handleScanInvoice}
                    variant="subtle"
                    style={{ flex: 1 }}
                  />
                </SSHStack>

                {decodedInvoice && !isLNURLMode && (
                  <SSPaymentDetails
                    decodedInvoice={decodedInvoice}
                    fiatCurrency={fiatCurrency}
                    satsToFiat={satsToFiat}
                  />
                )}

                {isLNURLMode && (
                  <SSLNURLDetails
                    lnurlDetails={lnurlDetails}
                    isFetching={isFetchingLNURL}
                    showCommentInfo
                    amount={amount}
                    onAmountChange={setAmount}
                    comment={comment}
                    onCommentChange={setComment}
                    inputStyles={styles.input}
                    fiatCurrency={fiatCurrency}
                    satsToFiat={satsToFiat}
                  />
                )}
              </SSVStack>
              <SSButton
                label={t('ecash.send.meltTokens')}
                onPress={handleMeltTokens}
                loading={isMelting || isFetchingLNURL}
                variant="gradient"
                gradientType="special"
              />

              {/* Status Message */}
              {statusMessage && (
                <SSText color="muted" size="sm">
                  {statusMessage}
                </SSText>
              )}
            </SSVStack>
          )}
        </SSVStack>
      </ScrollView>
      <SSCameraModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
        onContentScanned={handleContentScanned}
        context="ecash"
        title="Scan Lightning Invoice"
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  invoiceInput: {
    fontFamily: 'monospace',
    fontSize: 12,
    height: 'auto',
    padding: 10
  },
  tokenInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
    fontSize: 12,
    height: 'auto',
    padding: 10
  },
  fiatAmount: {
    marginTop: 4,
    marginLeft: 4
  },
  input: {
    backgroundColor: '#242424',
    borderRadius: 3,
    padding: 12,
    color: 'white',
    fontSize: 16
  }
})
