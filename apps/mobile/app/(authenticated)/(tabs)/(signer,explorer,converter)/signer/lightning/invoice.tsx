import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSModal from '@/components/SSModal'
import SSPairedTabs from '@/components/SSPairedTabs'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import { LND_INVOICE_POLL_MS } from '@/constants/lightning'
import { useFiatData } from '@/hooks/useFiatData'
import { useLND } from '@/hooks/useLND'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import type { LNURLWithdrawDetails } from '@/types/models/Lightning'
import { type DetectedContent } from '@/utils/contentDetector'
import { formatNumber } from '@/utils/format'
import { getLndErrorMessage } from '@/utils/lndHttpError'
import {
  lndInvoiceLookupPath,
  parseLndInvoiceUiStatus,
  type LndInvoiceUiStatus
} from '@/utils/lndInvoiceStatus'
import {
  decodeLNURL,
  fetchLNURLWithdrawDetails,
  getLNURLType,
  isLNURL,
  requestLNURLWithdrawInvoice
} from '@/utils/lnurl'

type InvoiceTab = 'lightning' | 'onchain'

const QR_CODE_HORIZONTAL_PADDING = 40
const QR_CODE_MAX_SIZE = 300

export default function InvoicePage() {
  const router = useRouter()
  const { width: screenWidth } = useWindowDimensions()
  const qrCodeSize = Math.min(
    screenWidth - QR_CODE_HORIZONTAL_PADDING,
    QR_CODE_MAX_SIZE
  )
  const { config, createInvoice, getNewAddress, makeRequest } = useLND()
  const queryClient = useQueryClient()
  const [fiatCurrency, satsToFiat, btcPrice, fetchPrices] = usePriceStore(
    useShallow((state) => [
      state.fiatCurrency,
      state.satsToFiat,
      state.btcPrice,
      state.fetchPrices
    ])
  )
  const { fiatPriceApiUrl } = useFiatData()
  useQuery({
    queryFn: () => fetchPrices(fiatPriceApiUrl),
    queryKey: ['prices', fiatCurrency, fiatPriceApiUrl]
  })

  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [amountMode, setAmountMode] = useState<'sats' | 'fiat'>('sats')
  const [localFiatAmount, setLocalFiatAmount] = useState('')
  const [invoiceDescription, setInvoiceDescription] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [qrModalVisible, setQrModalVisible] = useState(false)
  const [paymentRequest, setPaymentRequest] = useState('')
  const [currentAmount, setCurrentAmount] = useState('')
  const [currentDescription, setCurrentDescription] = useState('')
  const [invoiceStatus, setInvoiceStatus] = useState<LndInvoiceUiStatus>('open')
  const [rHash, setRHash] = useState<string>('')
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [isLNURLMode, setIsLNURLMode] = useState(false)
  const [lnurlDetails, setLnurlDetails] = useState<LNURLWithdrawDetails | null>(
    null
  )
  const [activeTab, setActiveTab] = useState<InvoiceTab>('lightning')
  const [isGeneratingAddress, setIsGeneratingAddress] = useState(false)

  const newAddressQueryKey = ['lnd', 'new-address', config?.url]
  const addressQuery = useQuery({
    enabled: Boolean(config) && activeTab === 'onchain',
    queryFn: () => getNewAddress(false),
    queryKey: newAddressQueryKey
  })
  const onchainAddress = addressQuery.data?.address

  async function checkInvoiceStatus() {
    if (!rHash || !qrModalVisible) {
      return null
    }

    try {
      const response = await makeRequest<{ settled: boolean; state: string }>(
        lndInvoiceLookupPath(rHash)
      )
      const newStatus = parseLndInvoiceUiStatus(response.state)
      setInvoiceStatus(newStatus)
      if (newStatus === 'settled' && invoiceStatus !== 'settled') {
        toast.success(t('lightning.invoice.paymentReceived'))
      }
      return newStatus
    } catch {
      return null
    }
  }

  useQuery({
    enabled: qrModalVisible && Boolean(rHash),
    queryFn: checkInvoiceStatus,
    queryKey: ['lnd', 'invoice-status', rHash],
    refetchInterval: LND_INVOICE_POLL_MS
  })

  const handleAmountChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '')
    setInvoiceAmount(numericValue)
  }

  const handleFiatAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '')
    setLocalFiatAmount(cleaned)
    const fiat = Number(cleaned)
    if (!isNaN(fiat) && btcPrice && btcPrice > 0) {
      const sats = Math.round((fiat / btcPrice) * 1e8)
      setInvoiceAmount(sats > 0 ? sats.toString() : '')
    }
  }

  const handleSwitchToFiat = () => {
    if (!btcPrice || btcPrice <= 0) {
      return
    }
    if (invoiceAmount) {
      const fiat = satsToFiat(parseInt(invoiceAmount, 10))
      setLocalFiatAmount(fiat > 0 ? fiat.toFixed(2) : '')
    }
    setAmountMode('fiat')
  }

  const handleSwitchToSats = () => {
    setAmountMode('sats')
  }

  const isFormValid = () => {
    const amount = parseInt(invoiceAmount, 10)
    return (
      invoiceAmount.length > 0 &&
      !isNaN(amount) &&
      amount > 0 &&
      invoiceDescription.trim().length > 0
    )
  }

  const handleLNURLInput = async (lnurl: string) => {
    const { isLNURL: isLNURLInput, type: lnurlType } = getLNURLType(lnurl)

    if (!isLNURLInput) {
      return false
    }

    if (lnurlType === 'pay') {
      toast.error(t('lightning.invoice.lnurlPayType'))
      return false
    }

    // If we can't determine the type from the URL, try to fetch details
    if (!lnurlType) {
      try {
        const url = decodeLNURL(lnurl)
        const details = await fetchLNURLWithdrawDetails(url)

        // If we get here, it's a valid withdraw LNURL
        setLnurlDetails(details)
        setIsLNURLMode(true)

        // Pre-populate amount with max withdrawable if available
        if (details.maxWithdrawable) {
          const maxSats = Math.floor(details.maxWithdrawable / 1000)
          setInvoiceAmount(maxSats.toString())
        }

        // Pre-populate description if available
        if (details.defaultDescription) {
          setInvoiceDescription(details.defaultDescription)
        }

        return true
      } catch {
        toast.error(t('lightning.invoice.lnurlPayType'))
        return false
      }
    }

    // We know it's a withdraw LNURL
    if (lnurlType === 'withdraw') {
      try {
        const url = decodeLNURL(lnurl)
        const details = await fetchLNURLWithdrawDetails(url)
        setLnurlDetails(details)
        setIsLNURLMode(true)

        // Pre-populate amount with max withdrawable if available
        if (details.maxWithdrawable) {
          const maxSats = Math.floor(details.maxWithdrawable / 1000)
          setInvoiceAmount(maxSats.toString())
        }

        // Pre-populate description if available
        if (details.defaultDescription) {
          setInvoiceDescription(details.defaultDescription)
        }

        return true
      } catch {
        toast.error(t('lightning.invoice.lnurlFailed'))
        return false
      }
    }

    toast.error(t('lightning.invoice.lnurlNotWithdraw'))
    return false
  }

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync()
      if (!text) {
        toast.error(t('lightning.invoice.clipboardEmpty'))
        return
      }

      // Clean the text (remove any whitespace)
      const cleanText = text.trim()

      if (cleanText.toLowerCase().startsWith('lnbc')) {
        setPaymentRequest(cleanText)
        setQrModalVisible(true)
      } else if (isLNURL(cleanText)) {
        await handleLNURLInput(cleanText)
      } else {
        toast.error(t('lightning.invoice.invalidClipboard'))
      }
    } catch {
      toast.error(t('lightning.invoice.clipboardFailed'))
    }
  }

  const handleContentScanned = async (content: DetectedContent) => {
    setCameraModalVisible(false)
    const data = content.cleaned

    if (data.toLowerCase().startsWith('lnbc')) {
      // Handle bolt11 invoice
      setPaymentRequest(data)
      setQrModalVisible(true)
    } else if (isLNURL(data)) {
      await handleLNURLInput(data)
    } else {
      toast.error(t('lightning.invoice.invalidQr'))
    }
  }

  const handleCreateInvoice = async () => {
    if (!invoiceAmount || !invoiceDescription) {
      toast.error(t('lightning.invoice.fillFields'))
      return
    }

    const amount = parseInt(invoiceAmount, 10)
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('lightning.invoice.validAmount'))
      return
    }

    setIsProcessing(true)
    try {
      const bolt11Invoice = await createInvoice(amount, invoiceDescription)
      if (isLNURLMode && lnurlDetails) {
        const amountMillisats = amount * 1000
        if (
          amountMillisats < lnurlDetails.minWithdrawable ||
          amountMillisats > lnurlDetails.maxWithdrawable
        ) {
          throw new Error(
            t('lightning.invoice.withdrawRange', {
              max: Math.floor(lnurlDetails.maxWithdrawable / 1000),
              min: Math.ceil(lnurlDetails.minWithdrawable / 1000)
            })
          )
        }
        if (!bolt11Invoice.payment_request) {
          throw new Error(t('lightning.invoice.bolt11Failed'))
        }
        const response = await requestLNURLWithdrawInvoice(
          lnurlDetails.callback,
          amountMillisats,
          lnurlDetails.k1,
          invoiceDescription,
          bolt11Invoice.payment_request
        )
        if (response.status === 'ERROR') {
          throw new Error(
            response.reason || t('lightning.invoice.lnurlServiceFailed')
          )
        }
      }

      setPaymentRequest(bolt11Invoice.payment_request)
      setCurrentAmount(invoiceAmount)
      setCurrentDescription(invoiceDescription)
      setRHash(bolt11Invoice.r_hash || '')
      setInvoiceStatus('open')
      setQrModalVisible(true)
    } catch {
      toast.error(t('lightning.invoice.bolt11Failed'))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCopyToClipboard = async () => {
    await Clipboard.setStringAsync(paymentRequest)
    toast.success(t('common.copiedToClipboard'))
  }

  function handleOpenCamera() {
    setCameraModalVisible(true)
  }

  function handleCloseCamera() {
    setCameraModalVisible(false)
  }

  function handleCancel() {
    router.back()
  }

  function handleCloseQrModal() {
    setQrModalVisible(false)
  }

  async function handleCopyOnchainAddress() {
    if (!onchainAddress) {
      return
    }
    try {
      await Clipboard.setStringAsync(onchainAddress)
      toast.success(t('common.copiedToClipboard'))
    } catch {
      toast.error(t('lightning.invoice.addressFailed'))
    }
  }

  async function handleGenerateNewAddress() {
    setIsGeneratingAddress(true)
    try {
      const result = await getNewAddress(true)
      queryClient.setQueryData(newAddressQueryKey, result)
    } catch (error) {
      toast.error(
        `${t('lightning.invoice.addressFailed')}: ${getLndErrorMessage(error)}`
      )
    } finally {
      setIsGeneratingAddress(false)
    }
  }

  function handleRetryAddress() {
    void addressQuery.refetch()
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              {t('lightning.invoice.title')}
            </SSText>
          )
        }}
      />
      <SSMainLayout>
        <SSVStack>
          <SSPairedTabs<InvoiceTab>
            activeTab={activeTab}
            onChange={setActiveTab}
            primary={{
              key: 'lightning',
              label: t('lightning.invoice.lightningTab')
            }}
            secondary={{
              key: 'onchain',
              label: t('lightning.invoice.onchainTab')
            }}
          />
          {activeTab === 'lightning' ? (
            <View>
              <SSVStack gap="md">
                <SSVStack gap="xs">
                  <SSText uppercase>
                    {t('lightning.invoice.amountWithUnit', {
                      unit:
                        amountMode === 'sats' ? t('common.sats') : fiatCurrency
                    })}
                  </SSText>
                  {amountMode === 'sats' ? (
                    <TextInput
                      style={styles.input}
                      value={
                        invoiceAmount
                          ? formatNumber(parseInt(invoiceAmount, 10)).toString()
                          : ''
                      }
                      onChangeText={handleAmountChange}
                      placeholder={t('lightning.invoice.amountPlaceholderSats')}
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                    />
                  ) : (
                    <TextInput
                      style={styles.input}
                      value={localFiatAmount}
                      onChangeText={handleFiatAmountChange}
                      placeholder={t(
                        'lightning.invoice.amountPlaceholderFiat',
                        { currency: fiatCurrency }
                      )}
                      placeholderTextColor="#666"
                      keyboardType="decimal-pad"
                    />
                  )}
                  {amountMode === 'sats' ? (
                    <SSText
                      color="muted"
                      size="sm"
                      onPress={
                        btcPrice && btcPrice > 0
                          ? handleSwitchToFiat
                          : undefined
                      }
                      style={
                        btcPrice && btcPrice > 0
                          ? styles.switchableAmount
                          : undefined
                      }
                    >
                      ≈{' '}
                      {invoiceAmount
                        ? formatNumber(
                            satsToFiat(parseInt(invoiceAmount, 10)),
                            2
                          )
                        : '0'}{' '}
                      {fiatCurrency}
                    </SSText>
                  ) : (
                    <SSText
                      color="muted"
                      size="sm"
                      onPress={handleSwitchToSats}
                      style={styles.switchableAmount}
                    >
                      {invoiceAmount
                        ? `${formatNumber(parseInt(invoiceAmount, 10))} sats`
                        : '0 sats'}
                    </SSText>
                  )}
                  {isLNURLMode && lnurlDetails && (
                    <SSText color="muted" size="sm">
                      {t('lightning.invoice.availableWithdraw', {
                        amount: formatNumber(
                          Math.floor(lnurlDetails.maxWithdrawable / 1000)
                        )
                      })}
                    </SSText>
                  )}
                </SSVStack>
                <SSVStack style={styles.inputContainer}>
                  <SSText uppercase>
                    {t('lightning.invoice.description')}
                  </SSText>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={invoiceDescription}
                    onChangeText={setInvoiceDescription}
                    placeholder={t('lightning.invoice.descriptionPlaceholder')}
                    placeholderTextColor="#666"
                    multiline
                    numberOfLines={3}
                  />
                </SSVStack>
                <SSVStack style={styles.actions}>
                  <SSHStack gap="sm" style={styles.actionButtons}>
                    <SSButton
                      label={t('common.paste')}
                      onPress={handlePasteFromClipboard}
                      variant="outline"
                      style={styles.actionButton}
                    />
                    <SSButton
                      label={t('lightning.invoice.scanQr')}
                      onPress={handleOpenCamera}
                      variant="outline"
                      style={styles.actionButton}
                    />
                  </SSHStack>
                  <SSButton
                    label={
                      isLNURLMode
                        ? t('lightning.invoice.withdraw')
                        : t('lightning.invoice.createInvoice')
                    }
                    onPress={handleCreateInvoice}
                    variant="secondary"
                    loading={isProcessing}
                    disabled={!isFormValid()}
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
            </View>
          ) : (
            <SSVStack gap="md">
              {addressQuery.isLoading ? (
                <SSText color="muted" center>
                  {t('common.loading')}
                </SSText>
              ) : null}
              {addressQuery.error && !addressQuery.isLoading ? (
                <SSText
                  center
                  onPress={handleRetryAddress}
                  style={{ color: Colors.warning }}
                >
                  {t('lightning.invoice.addressFailed')}
                </SSText>
              ) : null}
              {onchainAddress ? (
                <>
                  <View style={styles.qrContainer}>
                    <SSQRCode size={qrCodeSize} value={onchainAddress} />
                  </View>
                  <View style={styles.addressBox}>
                    <SSText size="sm" type="mono">
                      {onchainAddress}
                    </SSText>
                  </View>
                  <SSButton
                    label={t('common.copy')}
                    onPress={handleCopyOnchainAddress}
                    variant="outline"
                  />
                  <SSButton
                    label={t('lightning.invoice.generateNewAddress')}
                    loading={isGeneratingAddress}
                    onPress={handleGenerateNewAddress}
                    variant="subtle"
                  />
                </>
              ) : null}
            </SSVStack>
          )}
        </SSVStack>
      </SSMainLayout>
      <SSModal
        visible={qrModalVisible}
        fullOpacity
        onClose={handleCloseQrModal}
      >
        <ScrollView style={styles.modalScrollView}>
          <SSVStack itemsCenter gap="md" style={styles.modalContent}>
            <SSVStack gap="sm" style={styles.invoiceDetails}>
              <SSText uppercase>{t('lightning.invoice.paymentDetails')}</SSText>

              <View style={styles.detailsContent}>
                <View style={styles.detailSection}>
                  <SSHStack gap="xs" style={styles.detailRow}>
                    <SSText color="muted" style={styles.detailLabel}>
                      {t('lightning.amount')}
                    </SSText>
                    <SSHStack gap="xs" style={styles.amountContainer}>
                      <SSText weight="medium">
                        {formatNumber(parseInt(currentAmount, 10))} sats
                      </SSText>
                      <SSText color="muted" size="sm">
                        ≈{' '}
                        {formatNumber(
                          satsToFiat(parseInt(currentAmount, 10)),
                          2
                        )}{' '}
                        {fiatCurrency}
                      </SSText>
                    </SSHStack>
                  </SSHStack>
                  <SSHStack gap="xs" style={styles.detailRow}>
                    <SSText color="muted" style={styles.detailLabel}>
                      {t('lightning.invoice.description')}
                    </SSText>
                    <SSText style={styles.detailValue}>
                      {currentDescription}
                    </SSText>
                  </SSHStack>
                  <SSHStack gap="xs" style={styles.detailRow}>
                    <SSText color="muted" style={styles.detailLabel}>
                      {t('lightning.invoice.status')}
                    </SSText>
                    <SSText
                      style={styles.detailValue}
                      color={invoiceStatus === 'settled' ? 'white' : 'muted'}
                    >
                      {invoiceStatus === 'settled'
                        ? t('lightning.invoice.paid')
                        : invoiceStatus === 'canceled'
                          ? t('lightning.invoice.canceled')
                          : t('lightning.invoice.waiting')}
                    </SSText>
                  </SSHStack>
                </View>
              </View>
            </SSVStack>
            <View style={styles.qrContainer}>
              {paymentRequest && (
                <SSQRCode value={paymentRequest} size={qrCodeSize} />
              )}
            </View>
            <SSVStack style={styles.paymentRequestContainer}>
              <SSText color="muted" uppercase>
                {t('lightning.invoice.paymentRequest')}
              </SSText>
              <View style={styles.paymentRequestText}>
                <SSText type="mono" size="sm">
                  {paymentRequest}
                </SSText>
              </View>
            </SSVStack>

            <SSVStack style={styles.modalActions}>
              <SSButton
                label={t('common.copyToClipboard')}
                onPress={handleCopyToClipboard}
                variant="gradient"
                gradientType="special"
              />
            </SSVStack>
          </SSVStack>
        </ScrollView>
      </SSModal>
      <SSCameraModal
        visible={cameraModalVisible}
        onClose={handleCloseCamera}
        onContentScanned={handleContentScanned}
        context="lightning"
        title={t('lightning.invoice.scanLightningTitle')}
      />
    </>
  )
}

const styles = StyleSheet.create({
  actionButton: {
    flex: 1
  },
  actionButtons: {
    marginBottom: 8,
    width: '100%'
  },
  actions: {
    gap: 12,
    marginTop: 8
  },
  addressBox: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  amountContainer: {
    alignItems: 'baseline',
    flex: 1,
    justifyContent: 'flex-end'
  },
  button: {
    width: '100%'
  },
  content: {
    flex: 1,
    gap: 24
  },
  detailLabel: {
    fontSize: 14,
    minWidth: 100
  },
  detailRow: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  detailSection: {
    gap: 12
  },
  detailValue: {
    flex: 1,
    textAlign: 'right'
  },
  detailsContent: {
    gap: 16
  },
  form: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    gap: 16,
    padding: 20
  },
  input: {
    backgroundColor: '#242424',
    borderRadius: 3,
    color: 'white',
    fontSize: 16,
    padding: 12
  },
  inputContainer: {
    gap: 8
  },
  inputHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  invoiceDetails: {
    gap: 12,
    width: '100%'
  },
  mainLayout: {
    paddingHorizontal: '5%',
    paddingTop: 32
  },
  modalActions: {
    gap: 12,
    marginTop: 16,
    width: '100%'
  },
  modalContent: {
    padding: 10,
    width: '100%'
  },
  modalScrollView: {
    maxHeight: '90%',
    width: '100%'
  },
  paymentRequestContainer: {
    gap: 8,
    width: '100%'
  },
  paymentRequestText: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    width: '100%'
  },
  qrContainer: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    justifyContent: 'center',
    padding: 16,
    width: '100%'
  },
  scanButton: {
    minWidth: 100
  },
  switchableAmount: {
    textDecorationLine: 'underline'
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top'
  }
})
