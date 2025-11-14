import { getDecodedToken } from '@cashu/cashu-ts'
import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSEcashTokenDetails from '@/components/SSEcashTokenDetails'
import SSModal from '@/components/SSModal'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useEcash, useQuotePolling } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { error, success, warning, white } from '@/styles/colors'
import { type EcashToken } from '@/types/models/Ecash'
import {
  decodeLNURL,
  fetchLNURLWithdrawDetails,
  getLNURLType,
  type LNURLWithdrawDetails,
  requestLNURLWithdrawInvoice
} from '@/utils/lnurl'

export default function EcashReceivePage() {
  const router = useRouter()
  const { token: tokenParam, lnurl: lnurlParam } = useLocalSearchParams<{
    token?: string
    lnurl?: string
  }>()
  const [activeTab, setActiveTab] = useState<'ecash' | 'lightning'>('ecash')
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
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()
  const [lnurlWithdrawCode, setLnurlWithdrawCode] = useState<string | null>(
    null
  )
  const [lnurlWithdrawDetails, setLnurlWithdrawDetails] =
    useState<LNURLWithdrawDetails | null>(null)
  const [isLNURLWithdrawMode, setIsLNURLWithdrawMode] = useState(false)
  const [isFetchingLNURL, setIsFetchingLNURL] = useState(false)

  const {
    activeMint,
    receiveEcash,
    createMintQuote,
    checkMintQuote,
    mintProofs
  } = useEcash()

  const { isPolling, startPolling, stopPolling } = useQuotePolling()

  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )

  // Cleanup polling when component unmounts or tab changes
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  // Stop polling when switching tabs
  useEffect(() => {
    if (activeTab !== 'lightning') {
      stopPolling()
    }
  }, [activeTab, stopPolling])

  // Handle URL params
  useEffect(() => {
    if (tokenParam) {
      setActiveTab('ecash')
      handleTokenChange(tokenParam)
    } else if (lnurlParam) {
      setActiveTab('lightning')
      handleLNURLWithdrawInput(lnurlParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenParam, lnurlParam])

  // Handle LNURL-w input
  const handleLNURLWithdrawInput = useCallback(async (input: string) => {
    const cleanInput = input.trim()
    if (!cleanInput) return

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
      // Auto-populate amount with max withdrawable (in sats)
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
  }, [])

  const handleRedeemToken = useCallback(async () => {
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
  }, [token, activeMint, receiveEcash, router])

  const handleCreateInvoice = useCallback(async () => {
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

      // Validate amount against LNURL-w limits if in withdraw mode
      if (isLNURLWithdrawMode && lnurlWithdrawDetails) {
        const amountMillisats = amountSats * 1000
        if (
          amountMillisats < lnurlWithdrawDetails.minWithdrawable ||
          amountMillisats > lnurlWithdrawDetails.maxWithdrawable
        ) {
          toast.error(
            t('ecash.error.amountOutOfRange', {
              min: Math.ceil(
                lnurlWithdrawDetails.minWithdrawable / 1000
              ).toString(),
              max: Math.floor(
                lnurlWithdrawDetails.maxWithdrawable / 1000
              ).toString()
            })
          )
          setIsCreatingQuote(false)
          return
        }
      }

      // Create mint quote (bolt11 invoice)
      const quote = await createMintQuote(activeMint.url, amountSats, memo)
      setMintQuote(quote)
      setQuoteStatus('PENDING')
      toast.success(t('ecash.success.invoiceCreated'))

      // If in LNURL-w mode, request withdraw with the bolt11 invoice
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
          // Continue anyway - the invoice is created and can be displayed
        }
      }

      // Start automatic polling for payment status with a small delay
      setTimeout(() => {
        startPolling(async () => {
          if (!activeMint || !quote) return false

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
              return true // Stop polling
            } else if (status === 'EXPIRED' || status === 'CANCELLED') {
              stopPolling()
              toast.error(t('ecash.error.paymentFailed'))
              return true // Stop polling
            }
            // Continue polling for PENDING, UNPAID, and unknown statuses
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
      }, 2000) // Wait 2 seconds before starting to poll
    } catch {
      // Error handling is done in the hook
    } finally {
      setIsCreatingQuote(false)
    }
  }, [
    amount,
    memo,
    activeMint,
    createMintQuote,
    checkMintQuote,
    mintProofs,
    startPolling,
    stopPolling,
    router,
    isLNURLWithdrawMode,
    lnurlWithdrawDetails,
    lnurlWithdrawCode
  ])

  const handleTokenChange = useCallback((text: string) => {
    setToken(text)
    setDecodedToken(null) // Clear previous decode

    const cleanText = text.trim()
    if (!cleanText) return

    if (cleanText.toLowerCase().startsWith('cashu')) {
      try {
        const decoded = getDecodedToken(cleanText)
        setDecodedToken(decoded as EcashToken)
      } catch {
        setDecodedToken(null)
      }
    }
  }, [])

  const handlePasteToken = useCallback(async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync()
      if (clipboardText) {
        if (activeTab === 'ecash') {
          await handleTokenChange(clipboardText)
          toast.success(t('ecash.success.tokenPasted'))
        } else if (activeTab === 'lightning') {
          // Check if it's an LNURL-w code
          const { isLNURL: isLNURLInput, type: lnurlType } =
            getLNURLType(clipboardText)
          if (isLNURLInput && lnurlType === 'withdraw') {
            await handleLNURLWithdrawInput(clipboardText)
          } else {
            toast.error(t('ecash.error.invalidLnurlType'))
          }
        }
      } else {
        toast.error(t('ecash.error.noTextInClipboard'))
      }
    } catch {
      toast.error(t('ecash.error.failedToPaste'))
    }
  }, [handleTokenChange, activeTab, handleLNURLWithdrawInput])

  const handleScanToken = () => {
    setCameraModalVisible(true)
  }

  const handleQRCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      setCameraModalVisible(false)
      const cleanData = data.trim()

      if (activeTab === 'ecash') {
        // Handle ecash token
        const tokenData = cleanData.replace(/^cashu:/i, '')
        handleTokenChange(tokenData)
        toast.success(t('ecash.success.tokenScanned'))
      } else if (activeTab === 'lightning') {
        // Check if it's an LNURL-w code
        const { isLNURL: isLNURLInput, type: lnurlType } =
          getLNURLType(cleanData)
        if (isLNURLInput && lnurlType === 'withdraw') {
          handleLNURLWithdrawInput(cleanData)
        } else {
          toast.error(t('ecash.error.invalidLnurlType'))
        }
      }
    },
    [handleTokenChange, activeTab, handleLNURLWithdrawInput]
  )

  function getStatusColor(status: string) {
    switch (status) {
      case 'PENDING':
        return warning
      case 'PAID':
        return success
      case 'EXPIRED':
        return error
      case 'CANCELLED':
        return error
      case 'UNPAID':
        return warning
      case 'ISSUED':
        return success
      default:
        return white
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case 'PENDING':
        return t('ecash.quote.pending')
      case 'PAID':
        return t('ecash.quote.paid')
      case 'EXPIRED':
        return t('ecash.quote.expired')
      case 'CANCELLED':
        return t('ecash.quote.cancelled')
      case 'UNPAID':
        return t('ecash.quote.pending')
      case 'ISSUED':
        return t('ecash.quote.paid')
      default:
        return status || ''
    }
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('ecash.receive.title')}</SSText>
          )
        }}
      />

      <ScrollView>
        <SSVStack gap="lg" style={{ paddingBottom: 60 }}>
          {/* Tab Selector */}
          <SSHStack>
            <SSButton
              label={t('ecash.receive.ecashTab')}
              variant={activeTab === 'ecash' ? 'outline' : 'subtle'}
              style={{ flex: 1 }}
              onPress={() => setActiveTab('ecash')}
            />
            <SSButton
              label={t('ecash.receive.lightningTab')}
              variant={activeTab === 'lightning' ? 'outline' : 'subtle'}
              style={{ flex: 1 }}
              onPress={() => setActiveTab('lightning')}
            />
          </SSHStack>
          {activeTab === 'ecash' && (
            <SSVStack gap="sm">
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  {t('ecash.receive.token')}
                </SSText>
                <SSTextInput
                  value={token}
                  onChangeText={handleTokenChange}
                  placeholder="cashuAeyJ..."
                  multiline
                  numberOfLines={6}
                  style={styles.tokenInput}
                />
              </SSVStack>

              <SSHStack gap="sm">
                <SSButton
                  label={t('common.paste')}
                  onPress={handlePasteToken}
                  variant="subtle"
                  style={{ flex: 1 }}
                />
                <SSButton
                  label={t('common.scan')}
                  onPress={handleScanToken}
                  variant="subtle"
                  style={{ flex: 1 }}
                />
              </SSHStack>
              {decodedToken && (
                <SSEcashTokenDetails
                  decodedToken={decodedToken}
                  showMint
                  showProofs
                  fiatCurrency={fiatCurrency}
                  satsToFiat={satsToFiat}
                />
              )}
              <SSButton
                label={t('ecash.receive.redeemToken')}
                onPress={handleRedeemToken}
                loading={isRedeeming}
                variant="secondary"
                gradientType="special"
              />
            </SSVStack>
          )}
          {activeTab === 'lightning' && (
            <SSVStack gap="md">
              {isLNURLWithdrawMode && lnurlWithdrawDetails && (
                <SSVStack gap="xs" style={styles.lnurlDetails}>
                  <SSText color="muted" size="xs" uppercase>
                    {t('ecash.receive.lnurlWithdrawDetails')}
                  </SSText>
                  <SSVStack gap="xs">
                    <SSHStack gap="xs" style={styles.detailRow}>
                      <SSText color="muted" size="sm">
                        {t('ecash.receive.amountRange')}:
                      </SSText>
                      <SSText size="sm">
                        {Math.ceil(lnurlWithdrawDetails.minWithdrawable / 1000)}{' '}
                        -{' '}
                        {Math.floor(
                          lnurlWithdrawDetails.maxWithdrawable / 1000
                        )}{' '}
                        sats
                      </SSText>
                    </SSHStack>
                  </SSVStack>
                </SSVStack>
              )}
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  {t('ecash.receive.amount')}
                </SSText>
                <SSTextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  keyboardType="numeric"
                  editable={!isFetchingLNURL}
                />
                {isLNURLWithdrawMode &&
                  lnurlWithdrawDetails &&
                  amount &&
                  !isNaN(Number(amount)) && (
                    <SSText color="muted" size="xs">
                      {Number(amount) * 1000 <
                      lnurlWithdrawDetails.minWithdrawable
                        ? t('ecash.error.amountTooLow')
                        : Number(amount) * 1000 >
                            lnurlWithdrawDetails.maxWithdrawable
                          ? t('ecash.error.amountTooHigh')
                          : ''}
                    </SSText>
                  )}
              </SSVStack>
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  {t('ecash.receive.memo')}
                </SSText>
                <SSTextInput
                  value={memo}
                  onChangeText={setMemo}
                  placeholder={
                    lnurlWithdrawDetails?.defaultDescription ||
                    t('ecash.receive.memoPlaceholder')
                  }
                />
              </SSVStack>

              {!mintQuote ? (
                <SSVStack gap="sm">
                  <SSHStack gap="sm">
                    <SSButton
                      label={t('common.paste')}
                      onPress={handlePasteToken}
                      variant="subtle"
                      style={{ flex: 1 }}
                    />
                    <SSButton
                      label={t('common.scan')}
                      onPress={handleScanToken}
                      variant="subtle"
                      style={{ flex: 1 }}
                    />
                  </SSHStack>
                  <SSButton
                    label={
                      isLNURLWithdrawMode
                        ? t('ecash.receive.withdraw')
                        : t('ecash.receive.createInvoice')
                    }
                    onPress={handleCreateInvoice}
                    loading={isCreatingQuote || isFetchingLNURL}
                    variant="gradient"
                    gradientType="special"
                    disabled={
                      !amount ||
                      isFetchingLNURL ||
                      (isLNURLWithdrawMode &&
                        lnurlWithdrawDetails !== null &&
                        (Number(amount) * 1000 <
                          lnurlWithdrawDetails.minWithdrawable ||
                          Number(amount) * 1000 >
                            lnurlWithdrawDetails.maxWithdrawable))
                    }
                  />
                </SSVStack>
              ) : (
                <SSVStack gap="md">
                  {/* Display Lightning Invoice - only show QR for non-LNURL-w */}
                  {!isLNURLWithdrawMode && (
                    <View style={styles.qrContainer}>
                      <SSQRCode value={mintQuote.request} size={300} />
                    </View>
                  )}
                  {!isLNURLWithdrawMode && (
                    <SSButton
                      label={t('common.copy')}
                      onPress={async () => {
                        try {
                          await Clipboard.setStringAsync(mintQuote.request)
                          toast.success(t('common.copiedToClipboard'))
                        } catch {
                          toast.error(t('ecash.error.failedToCopy'))
                        }
                      }}
                      variant="outline"
                    />
                  )}

                  {/* Quote Status */}
                  <SSVStack gap="none">
                    <SSText style={{ color: getStatusColor(quoteStatus) }}>
                      {getStatusText(quoteStatus)}
                    </SSText>
                    {isPolling && (
                      <SSText color="muted" size="xs">
                        {t('ecash.receive.polling')}
                      </SSText>
                    )}
                    {isLNURLWithdrawMode && (
                      <SSText color="muted" size="sm">
                        {t('ecash.receive.withdrawPending')}
                      </SSText>
                    )}
                  </SSVStack>
                </SSVStack>
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
  container: {
    paddingHorizontal: 20
  },
  tokenInput: {
    height: 'auto',
    minHeight: 100,
    textAlignVertical: 'top',
    padding: 10,
    fontSize: 14,
    fontFamily: 'monospace'
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 20
  },
  camera: {
    flex: 1,
    width: '100%'
  },
  lnurlDetails: {
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 4
  },
  detailRow: {
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap'
  }
})
