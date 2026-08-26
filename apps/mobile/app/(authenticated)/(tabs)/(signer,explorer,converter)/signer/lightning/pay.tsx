import { useQuery } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { useFonts } from 'expo-font'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSAmountInput from '@/components/SSAmountInput'
import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSLNURLDetails from '@/components/SSLNURLDetails'
import SSNumberInput from '@/components/SSNumberInput'
import SSPairedTabs from '@/components/SSPairedTabs'
import SSPaymentDetails from '@/components/SSPaymentDetails'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { DUST_LIMIT } from '@/constants/btc'
import {
  LND_OPEN_CHANNEL_MAX_SAT_PER_VBYTE,
  LND_SUCCESS_NAVIGATE_DELAY_MS
} from '@/constants/lightning'
import { useFiatData } from '@/hooks/useFiatData'
import { useLND } from '@/hooks/useLND'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { useZapFlowStore } from '@/store/zapFlow'
import { Colors, Typography } from '@/styles'
import type {
  LNDDecodedInvoice,
  LNURLPayResponse
} from '@/types/models/Lightning'
import { type DetectedContent } from '@/utils/contentDetector'
import { isAmountlessBolt11Invoice } from '@/utils/lightningInvoiceDecoder'
import { getLndErrorMessage } from '@/utils/lndHttpError'
import {
  type LndOnchainSendValidationReason,
  buildSendCoinsBody,
  parseBitcoinUriAddress,
  validateLndOnchainSend
} from '@/utils/lndOnchainWallet'
import { parsePositiveSats } from '@/utils/lndPayInvoice'
import {
  decodeLNURL,
  fetchLNURLPayDetails,
  handleLNURLPay,
  isLNURL
} from '@/utils/lnurl'

type PayTab = 'lightning' | 'onchain'

function onchainValidationMessage(
  reason: LndOnchainSendValidationReason
): string {
  if (reason === 'address') {
    return t('lightning.pay.invalidAddress')
  }
  if (reason === 'amount') {
    return t('lightning.pay.invalidAmount')
  }
  if (reason === 'balance') {
    return t('lightning.pay.invalidBalance')
  }
  return t('lightning.pay.invalidFee')
}

export default function PayPage() {
  const router = useRouter()
  const { paymentRequest: paymentRequestParam, invoice: invoiceParam } =
    useLocalSearchParams()
  const {
    config,
    getBalance,
    isConnected,
    makeRequest,
    payInvoice,
    sendCoins,
    verifyConnection
  } = useLND()

  const [fontsLoaded] = useFonts({
    'SF-NS-Mono': require('@/assets/fonts/SF-NS-Mono.ttf')
  })

  const [paymentRequest, setPaymentRequest] = useState('')
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isFetchingDetails, setIsFetchingDetails] = useState(false)
  const detailsRequestId = useRef(0)
  const [fiatCurrency, satsToFiat, fetchPrices, _btcPrice] = usePriceStore(
    useShallow((state) => [
      state.fiatCurrency,
      state.satsToFiat,
      state.fetchPrices,
      state.btcPrice
    ])
  )
  const { fiatPriceApiUrl } = useFiatData()
  useQuery({
    queryFn: () => fetchPrices(fiatPriceApiUrl),
    queryKey: ['prices', fiatCurrency, fiatPriceApiUrl]
  })
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [isLNURLMode, setIsLNURLMode] = useState(false)
  const [lnurlDetails, setLNURLDetails] = useState<LNURLPayResponse | null>(
    null
  )
  const [decodedInvoice, setDecodedInvoice] =
    useState<LNDDecodedInvoice | null>(null)
  const [activeTab, setActiveTab] = useState<PayTab>('lightning')
  const [onchainAddress, setOnchainAddress] = useState('')
  const [onchainAmountSat, setOnchainAmountSat] = useState(0)
  const [satPerVbyteText, setSatPerVbyteText] = useState('')

  const balanceQuery = useQuery({
    enabled: Boolean(config) && activeTab === 'onchain',
    queryFn: getBalance,
    queryKey: ['lnd', 'onchain-balance', config?.url]
  })
  const confirmedSat = Number(balanceQuery.data?.confirmed_balance ?? 0)
  const onchainAmountMax = Math.max(confirmedSat, DUST_LIMIT)

  async function handleLNURLDetected(lnurl: string) {
    const requestId = detailsRequestId.current + 1
    detailsRequestId.current = requestId
    setIsFetchingDetails(true)
    try {
      const url = isLNURL(lnurl) ? decodeLNURL(lnurl) : lnurl
      const details = await fetchLNURLPayDetails(url)
      if (requestId !== detailsRequestId.current) {
        return
      }
      setLNURLDetails(details)
      const minSats = Math.ceil(details.minSendable / 1000)
      setAmount(minSats.toString())
    } catch {
      if (requestId !== detailsRequestId.current) {
        return
      }
      setLNURLDetails(null)
    } finally {
      if (requestId === detailsRequestId.current) {
        setIsFetchingDetails(false)
      }
    }
  }

  async function decodeInvoice(invoice: string) {
    const requestId = detailsRequestId.current + 1
    detailsRequestId.current = requestId
    setIsFetchingDetails(true)
    try {
      const response = await makeRequest<LNDDecodedInvoice>(
        `/v1/payreq/${invoice}`
      )
      if (requestId !== detailsRequestId.current) {
        return null
      }
      setDecodedInvoice(response)
      return response
    } catch {
      if (requestId === detailsRequestId.current) {
        setDecodedInvoice(null)
      }
      return null
    } finally {
      if (requestId === detailsRequestId.current) {
        setIsFetchingDetails(false)
      }
    }
  }

  async function handlePaymentRequestChange(text: string) {
    setPaymentRequest(text)
    const isLNURLInput = isLNURL(text)
    setIsLNURLMode(isLNURLInput)
    setDecodedInvoice(null)
    setLNURLDetails(null)

    if (!isConnected) {
      const isStillConnected = await verifyConnection()
      if (!isStillConnected) {
        toast.error(t('lightning.pay.notConnected'))
        return
      }
    }

    if (isLNURLInput) {
      await handleLNURLDetected(text)
      return
    }
    if (text.toLowerCase().startsWith('lnbc')) {
      const decoded = await decodeInvoice(text)
      if (!decoded) {
        return
      }
      if (isAmountlessBolt11Invoice(decoded)) {
        setAmount('')
      } else {
        setAmount(decoded.num_satoshis)
      }
      return
    }
    detailsRequestId.current += 1
    setIsFetchingDetails(false)
    setDecodedInvoice(null)
  }

  function handleAmountChange(text: string) {
    setAmount(text)
  }

  const handleSendPayment = async () => {
    if (!paymentRequest) {
      toast.error(t('lightning.pay.enterPaymentRequestError'))
      return
    }

    if (!isLNURLMode && !decodedInvoice) {
      toast.error(t('lightning.pay.waitDecode'))
      return
    }
    await processPayment()
  }

  const processPayment = async () => {
    if (!paymentRequest) {
      return
    }

    if (!isLNURLMode && !decodedInvoice) {
      toast.error(t('lightning.pay.tryAgain'))
      return
    }

    setIsProcessing(true)
    try {
      if (isLNURLMode) {
        const amountSats = parsePositiveSats(amount)
        if (amountSats === null) {
          toast.error(t('lightning.pay.validAmount'))
          setIsProcessing(false)
          return
        }
        const invoice = await handleLNURLPay(
          paymentRequest,
          amountSats,
          comment || undefined
        )
        await payInvoice(invoice)
      } else if (decodedInvoice && isAmountlessBolt11Invoice(decodedInvoice)) {
        const amountSats = parsePositiveSats(amount)
        if (amountSats === null) {
          toast.error(t('lightning.pay.validAmount'))
          setIsProcessing(false)
          return
        }
        await payInvoice(paymentRequest, amountSats)
      } else {
        await payInvoice(paymentRequest)
      }
      toast.success(t('lightning.pay.paymentSent'))
      const { pendingZap, setZapResult } = useZapFlowStore.getState()
      if (pendingZap) {
        setZapResult('success')
      }
      setTimeout(router.back, LND_SUCCESS_NAVIGATE_DELAY_MS)
    } catch (error) {
      const fallback = t('lightning.pay.paymentFailed')
      if (!(error instanceof Error)) {
        toast.error(fallback)
        return
      }
      if (
        error.message.includes('404') ||
        error.message.includes('Not Found')
      ) {
        toast.error(t('lightning.pay.paymentExpired'))
        return
      }
      toast.error(error.message || fallback)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleContentScanned = (content: DetectedContent) => {
    setCameraModalVisible(false)
    if (activeTab === 'onchain') {
      const address = parseBitcoinUriAddress(content.cleaned)
      if (!address) {
        toast.error(t('lightning.pay.invalidAddress'))
        return
      }
      setOnchainAddress(address)
      return
    }
    const cleanText = content.cleaned.replace(/^lightning:/i, '')

    if (cleanText.toLowerCase().startsWith('lnbc') || isLNURL(cleanText)) {
      handlePaymentRequestChange(cleanText)
    } else {
      toast.error(t('lightning.pay.invalidQr'))
    }
  }

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync()
      if (!text) {
        toast.error(t('lightning.pay.clipboardEmpty'))
        return
      }

      const cleanText = text.trim()

      if (activeTab === 'onchain') {
        const address = parseBitcoinUriAddress(cleanText)
        if (!address) {
          toast.error(t('lightning.pay.invalidAddress'))
          return
        }
        setOnchainAddress(address)
        return
      }

      if (cleanText.toLowerCase().startsWith('lnbc') || isLNURL(cleanText)) {
        await handlePaymentRequestChange(cleanText)
      } else {
        toast.error(t('lightning.pay.invalidClipboard'))
      }
    } catch {
      toast.error(t('lightning.pay.clipboardFailed'))
    }
  }

  function handleOpenCamera() {
    setCameraModalVisible(true)
  }

  function handleCloseCamera() {
    setCameraModalVisible(false)
  }

  function handleOnchainAddressChange(text: string) {
    setOnchainAddress(text)
  }

  function handleOnchainAmountChange(value: number) {
    setOnchainAmountSat(value)
  }

  function handleFeeChange(text: string) {
    setSatPerVbyteText(text)
  }

  function handleCancel() {
    router.back()
  }

  async function handleSendOnchain() {
    const validation = validateLndOnchainSend({
      address: onchainAddress,
      amountText: String(onchainAmountSat),
      confirmedBalanceSat: confirmedSat,
      satPerVbyteText
    })
    if (!validation.ok) {
      toast.error(onchainValidationMessage(validation.reason))
      return
    }
    const addr = parseBitcoinUriAddress(onchainAddress)
    if (!addr) {
      toast.error(t('lightning.pay.invalidAddress'))
      return
    }
    setIsProcessing(true)
    try {
      await sendCoins(
        buildSendCoinsBody({
          addr,
          amountSat: validation.amountSat,
          satPerVbyte: validation.satPerVbyte
        })
      )
      toast.success(t('lightning.pay.onchainSuccess'))
      setTimeout(router.back, LND_SUCCESS_NAVIGATE_DELAY_MS)
    } catch (error) {
      toast.error(
        `${t('lightning.pay.sendFailed')}: ${getLndErrorMessage(error)}`
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const isAmountlessInvoice =
    decodedInvoice !== null &&
    !isLNURLMode &&
    isAmountlessBolt11Invoice(decodedInvoice)

  const inboundParam = paymentRequestParam || invoiceParam
  const inboundValue = Array.isArray(inboundParam)
    ? inboundParam[0]
    : inboundParam
  const inboundClean = inboundValue
    ? inboundValue.trim().replace(/^lightning:/i, '')
    : ''
  const inboundEnabled =
    inboundClean.toLowerCase().startsWith('lnbc') || isLNURL(inboundClean)

  useQuery({
    enabled: inboundEnabled,
    queryFn: async () => {
      await handlePaymentRequestChange(inboundClean)
      return inboundClean
    },
    queryKey: ['lnd', 'pay-inbound', inboundClean]
  })

  if (!fontsLoaded) {
    return null
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              {t('lightning.pay.title')}
            </SSText>
          )
        }}
      />
      <SSMainLayout>
        <ScrollView>
          <SSVStack gap="md">
            <SSPairedTabs<PayTab>
              activeTab={activeTab}
              onChange={setActiveTab}
              primary={{
                key: 'lightning',
                label: t('lightning.pay.lightningTab')
              }}
              secondary={{
                key: 'onchain',
                label: t('lightning.pay.onchainTab')
              }}
            />
            {activeTab === 'lightning' ? (
              <View>
                <SSVStack>
                  {isFetchingDetails ? (
                    <SSHStack gap="sm" style={styles.fetchingBanner}>
                      <ActivityIndicator color={Colors.gray[400]} />
                      <SSText color="muted" size="sm">
                        {isLNURLMode
                          ? t('lightning.pay.fetchingDetails')
                          : t('lightning.pay.decodingInvoice')}
                      </SSText>
                    </SSHStack>
                  ) : null}
                  <SSVStack gap="sm">
                    <TextInput
                      style={[
                        styles.input,
                        styles.textArea,
                        styles.monospaceInput
                      ]}
                      value={paymentRequest}
                      onChangeText={handlePaymentRequestChange}
                      placeholder={
                        isLNURLMode
                          ? t('lightning.pay.enterLnurl')
                          : t('lightning.pay.enterPaymentRequest')
                      }
                      placeholderTextColor="#666"
                      multiline
                      numberOfLines={6}
                      editable={!isFetchingDetails}
                    />

                    <SSHStack gap="sm" style={styles.actionButtons}>
                      <SSButton
                        label={t('common.paste')}
                        onPress={handlePasteFromClipboard}
                        variant="subtle"
                        style={[styles.actionButton, styles.buttonWithIcon]}
                        disabled={isFetchingDetails}
                      />
                      <SSButton
                        label={t('lightning.invoice.scanQr')}
                        onPress={handleOpenCamera}
                        variant="subtle"
                        style={[styles.actionButton, styles.buttonWithIcon]}
                        disabled={isFetchingDetails}
                      />
                    </SSHStack>
                  </SSVStack>
                  {decodedInvoice && !isLNURLMode && (
                    <SSPaymentDetails
                      decodedInvoice={decodedInvoice}
                      showCreated
                      showPaymentHash
                      fiatCurrency={fiatCurrency}
                      privacyMode={privacyMode}
                      satsToFiat={satsToFiat}
                    />
                  )}
                  {isAmountlessInvoice ? (
                    <SSVStack gap="xs">
                      <SSText color="muted" size="sm">
                        {t('lightning.pay.amountlessHint')}
                      </SSText>
                      <SSText color="muted">{t('lightning.pay.amount')}</SSText>
                      <SSTextInput
                        align="left"
                        keyboardType="numeric"
                        onChangeText={handleAmountChange}
                        placeholder={t(
                          'lightning.invoice.amountPlaceholderSats'
                        )}
                        value={amount}
                      />
                      {parsePositiveSats(amount) !== null ? (
                        <SSText color="muted" size="sm">
                          {privacyMode
                            ? `≈ •••• ${fiatCurrency}`
                            : `≈ ${satsToFiat(Number(amount)).toLocaleString(
                                'en-US',
                                {
                                  maximumFractionDigits: 2,
                                  minimumFractionDigits: 2
                                }
                              )} ${fiatCurrency}`}
                        </SSText>
                      ) : null}
                    </SSVStack>
                  ) : null}
                  {isLNURLMode && (
                    <SSLNURLDetails
                      lnurlDetails={lnurlDetails}
                      isFetching={isFetchingDetails}
                      showCommentInfo
                      amount={amount}
                      onAmountChange={handleAmountChange}
                      comment={comment}
                      onCommentChange={setComment}
                      inputStyles={styles.input}
                      fiatCurrency={fiatCurrency}
                      privacyMode={privacyMode}
                      satsToFiat={satsToFiat}
                    />
                  )}
                </SSVStack>
                <SSVStack style={styles.actions}>
                  <SSButton
                    label={t('lightning.pay.sendPayment')}
                    onPress={handleSendPayment}
                    variant="secondary"
                    loading={isProcessing || isFetchingDetails}
                    disabled={
                      !paymentRequest.trim() ||
                      ((isLNURLMode || isAmountlessInvoice) &&
                        parsePositiveSats(amount) === null) ||
                      (!isLNURLMode && !decodedInvoice) ||
                      isFetchingDetails
                    }
                    style={styles.button}
                  />
                  <SSButton
                    label={t('common.cancel')}
                    onPress={handleCancel}
                    variant="ghost"
                    style={styles.button}
                    disabled={isFetchingDetails}
                  />
                </SSVStack>
              </View>
            ) : (
              <SSVStack gap="md">
                <SSVStack gap="xs">
                  <SSText color="muted" size="sm">
                    {t('lightning.pay.confirmedBalance')}
                  </SSText>
                  {balanceQuery.isLoading ? (
                    <SSText color="muted">{t('common.loading')}</SSText>
                  ) : (
                    <SSStyledSatText
                      amount={confirmedSat}
                      noColor
                      showSign={false}
                      textSize="xl"
                    />
                  )}
                </SSVStack>
                <SSFormLayout>
                  <SSFormLayout.Item>
                    <SSTextInput
                      align="left"
                      onChangeText={handleOnchainAddressChange}
                      placeholder={t('lightning.pay.addressPlaceholder')}
                      value={onchainAddress}
                    />
                    <SSHStack gap="sm" style={styles.actionButtons}>
                      <SSButton
                        label={t('common.paste')}
                        onPress={handlePasteFromClipboard}
                        variant="subtle"
                        style={styles.actionButton}
                      />
                      <SSButton
                        label={t('lightning.invoice.scanQr')}
                        onPress={handleOpenCamera}
                        variant="subtle"
                        style={styles.actionButton}
                      />
                    </SSHStack>
                  </SSFormLayout.Item>
                  <SSFormLayout.Item>
                    <SSFormLayout.Label
                      center={false}
                      label={t('lightning.pay.amount')}
                    />
                    <SSAmountInput
                      max={onchainAmountMax}
                      min={DUST_LIMIT}
                      onValueChange={handleOnchainAmountChange}
                      remainingSats={confirmedSat}
                      value={onchainAmountSat}
                    />
                  </SSFormLayout.Item>
                  <SSFormLayout.Item>
                    <SSFormLayout.Label
                      center={false}
                      label={t('lightning.pay.feeRate')}
                    />
                    <SSNumberInput
                      allowValidEmpty
                      max={LND_OPEN_CHANNEL_MAX_SAT_PER_VBYTE}
                      min={1}
                      onChangeText={handleFeeChange}
                      value={satPerVbyteText}
                    />
                  </SSFormLayout.Item>
                </SSFormLayout>
                <SSVStack style={styles.actions}>
                  <SSButton
                    label={t('lightning.pay.onchainSend')}
                    loading={isProcessing}
                    onPress={handleSendOnchain}
                    variant="secondary"
                    style={styles.button}
                  />
                  <SSButton
                    label={t('common.cancel')}
                    onPress={handleCancel}
                    variant="ghost"
                    style={styles.button}
                  />
                </SSVStack>
              </SSVStack>
            )}
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
      <SSCameraModal
        visible={cameraModalVisible}
        onClose={handleCloseCamera}
        onContentScanned={handleContentScanned}
        context={activeTab === 'onchain' ? 'bitcoin' : 'lightning'}
        title={
          activeTab === 'onchain'
            ? t('lightning.pay.scanOnchainTitle')
            : t('lightning.pay.scanLightningTitle')
        }
      />
    </>
  )
}

const styles = StyleSheet.create({
  actionButton: {
    flex: 1
  },
  actionButtons: {
    width: '100%'
  },
  actions: {
    gap: 12,
    marginTop: 16
  },
  button: {
    width: '100%'
  },
  buttonIcon: {
    marginRight: 4
  },
  buttonWithIcon: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center'
  },
  fetchingBanner: {
    justifyContent: 'center',
    marginBottom: 8,
    width: '100%'
  },
  fiatAmount: {
    marginLeft: 4,
    marginTop: 4
  },
  input: {
    backgroundColor: '#242424',
    borderRadius: 3,
    color: 'white',
    fontSize: 16,
    padding: 12
  },
  monospaceInput: {
    fontFamily: Typography.sfProMono,
    fontSize: 14,
    letterSpacing: 0.5
  },
  textArea: {
    height: 180,
    textAlignVertical: 'top'
  }
})
