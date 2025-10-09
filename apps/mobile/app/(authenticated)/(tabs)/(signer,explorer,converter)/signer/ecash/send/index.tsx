import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import SSAmountInput from '@/components/SSAmountInput'
import SSButton from '@/components/SSButton'
import SSLNURLDetails from '@/components/SSLNURLDetails'
import SSModal from '@/components/SSModal'
import SSPaymentDetails from '@/components/SSPaymentDetails'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useEcash } from '@/hooks/useEcash'
import { useLND } from '@/hooks/useLND'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import {
  decodeLNURL,
  fetchLNURLPayDetails,
  handleLNURLPay,
  isLNURL
} from '@/utils/lnurl'

// Define the type for makeRequest
type MakeRequest = <T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: unknown
    headers?: Record<string, string>
  }
) => Promise<T>

interface DecodedInvoice {
  payment_request: string
  value: string
  description: string
  timestamp: string
  expiry: string
  payment_hash: string
  payment_addr: string
  num_satoshis: string
  num_msat: string
  features: Record<string, { name: string }>
  route_hints: any[]
  payment_secret: string
  min_final_cltv_expiry: string
}

interface LNURLPayResponse {
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
  const [permission, requestPermission] = useCameraPermissions()
  const [decodedInvoice, setDecodedInvoice] = useState<DecodedInvoice | null>(
    null
  )
  const [isLNURLMode, setIsLNURLMode] = useState(false)
  const [lnurlDetails, setLNURLDetails] = useState<LNURLPayResponse | null>(
    null
  )
  const [isFetchingLNURL, setIsFetchingLNURL] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  const { activeMint, sendEcash, createMeltQuote, meltProofs, proofs } =
    useEcash()
  const { makeRequest, isConnected, verifyConnection } = useLND()
  const typedMakeRequest = makeRequest as MakeRequest

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
    // Clear previous token
    setGeneratedToken('')
    try {
      const result = await sendEcash(activeMint.url, amountNum, memo)
      // Store the generated token
      setGeneratedToken(result.token)
    } catch (error) {
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

      await meltProofs(activeMint.url, quote, proofs)
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
    comment
  ])

  // Decode a bolt11 invoice
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

  // Handle invoice input changes and auto-decode
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
      if (cleanText.toLowerCase().startsWith('lnbc')) {
        setIsLNURLMode(false)

        // Verify LND connection before proceeding
        if (!isConnected) {
          const isStillConnected = await verifyConnection()
          if (!isStillConnected) {
            Alert.alert(
              t('ecash.error.connectionError'),
              t('ecash.error.notConnectedToLND')
            )
            return
          }
        }

        try {
          const decoded = await decodeInvoice(cleanText)
          // Auto-populate amount from decoded invoice
          if (decoded.num_satoshis) {
            setAmount(decoded.num_satoshis)
          }
        } catch {
          setDecodedInvoice(null)
        }
      } else {
        setIsLNURLMode(false)
      }
    },
    [isConnected, verifyConnection, decodeInvoice]
  )

  // Handle invoice parameter from navigation
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
    } catch (error) {
      toast.error(t('ecash.error.failedToPaste'))
    }
  }, [handleInvoiceChange])

  const handleScanInvoice = useCallback(() => {
    setCameraModalVisible(true)
  }, [])

  const handleQRCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      setCameraModalVisible(false)
      // Clean the data (remove any whitespace and lightning: prefix)
      const cleanData = data.trim().replace(/^lightning:/i, '')
      handleInvoiceChange(cleanData)
      toast.success(t('ecash.success.invoiceScanned'))
    },
    [handleInvoiceChange]
  )

  const handleCopyToken = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(generatedToken)
      toast.success(t('common.copiedToClipboard'))
    } catch (error) {
      toast.error(t('ecash.error.failedToCopy'))
    }
  }, [generatedToken])

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('ecash.send.title')}</SSText>
        }}
      />

      <ScrollView>
        <SSVStack gap="lg">
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

          {/* Ecash Tab Content */}
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
                  <SSButton
                    label={t('common.copy')}
                    onPress={handleCopyToken}
                    variant="subtle"
                  />
                </SSVStack>
              )}
            </SSVStack>
          )}

          {/* Lightning Tab Content */}
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
                  <SSPaymentDetails decodedInvoice={decodedInvoice} />
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

      {/* Camera Modal */}
      <SSModal
        visible={cameraModalVisible}
        fullOpacity
        onClose={() => setCameraModalVisible(false)}
      >
        <SSText color="muted" uppercase>
          {t('camera.scanQRCode')}
        </SSText>
        <CameraView
          onBarcodeScanned={handleQRCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          style={styles.camera}
        />
        {!permission?.granted && (
          <SSButton
            label={t('camera.enableCameraAccess')}
            onPress={requestPermission}
          />
        )}
      </SSModal>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
    width: '100%'
  },
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
