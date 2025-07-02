import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import { useLND } from '@/hooks/useLND'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { formatNumber } from '@/utils/format'
import {
  decodeLNURL,
  fetchLNURLWithdrawDetails,
  getLNURLType,
  isLNURL,
  type LNURLWithdrawDetails,
  requestLNURLWithdrawInvoice
} from '@/utils/lnurl'

const screenWidth = Dimensions.get('window').width
const qrCodeSize = Math.min(screenWidth - 40, 300) // Account for modal padding (20px on each side)

type Invoice = {
  payment_request: string
  r_hash?: string | undefined
}

type InvoiceStatus = 'open' | 'settled' | 'canceled'

export default function InvoicePage() {
  const router = useRouter()
  const { createInvoice, makeRequest } = useLND()
  const { satsToFiat, fiatCurrency, fetchPrices } = usePriceStore()
  const [permission, requestPermission] = useCameraPermissions()
  const mempoolUrl = useBlockchainStore(
    (state) => state.configsMempool['bitcoin']
  )

  // Fetch prices on mount and when currency changes
  useEffect(() => {
    fetchPrices(mempoolUrl)
  }, [fetchPrices, fiatCurrency, mempoolUrl])

  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [invoiceDescription, setInvoiceDescription] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [qrModalVisible, setQrModalVisible] = useState(false)
  const [paymentRequest, setPaymentRequest] = useState('')
  const [currentAmount, setCurrentAmount] = useState('')
  const [currentDescription, setCurrentDescription] = useState('')
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>('open')
  const [rHash, setRHash] = useState<string>('')
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [isLNURLMode, setIsLNURLMode] = useState(false)
  const [lnurlDetails, setLnurlDetails] = useState<LNURLWithdrawDetails | null>(
    null
  )

  // Function to check invoice status
  const checkInvoiceStatus = useCallback(async () => {
    if (!rHash || !qrModalVisible) return

    try {
      // Convert r_hash to hex if it's not already
      const hexRHash = Buffer.from(rHash, 'base64').toString('hex')

      const response = await makeRequest<{ settled: boolean; state: string }>(
        `/v1/invoice/${hexRHash}`
      )

      const newStatus = response.state.toLowerCase() as InvoiceStatus
      setInvoiceStatus(newStatus)

      // If invoice is settled, show success message
      if (newStatus === 'settled' && invoiceStatus !== 'settled') {
        Alert.alert('Success', 'Payment received!')
      }
    } catch {
      // Error handling without console.error
    }
  }, [rHash, qrModalVisible, makeRequest, invoiceStatus])

  // Set up polling for invoice status
  useEffect(() => {
    if (!qrModalVisible || !rHash) return

    // Check immediately
    checkInvoiceStatus()

    // Then check every 3 seconds
    const interval = setInterval(checkInvoiceStatus, 3000)

    return () => clearInterval(interval)
  }, [qrModalVisible, rHash, checkInvoiceStatus])

  const handleAmountChange = (text: string) => {
    // Only allow numbers
    const numericValue = text.replace(/[^0-9]/g, '')
    setInvoiceAmount(numericValue)
  }

  const fiatAmount = invoiceAmount ? satsToFiat(parseInt(invoiceAmount, 10)) : 0

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
      Alert.alert(
        'Invalid LNURL Type',
        'This is a LNURL-pay code. Please use the Send Payment page instead.'
      )
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
        Alert.alert(
          'Invalid LNURL Type',
          'This LNURL appears to be a pay request. Please use the Send Payment page instead.'
        )
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
      } catch (error) {
        Alert.alert(
          'Error',
          error instanceof Error ? error.message : 'Failed to process LNURL'
        )
        return false
      }
    }

    Alert.alert(
      'Invalid LNURL',
      'This LNURL is not a withdraw request. Please use a valid LNURL-withdraw code.'
    )
    return false
  }

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync()
      if (!text) {
        Alert.alert('Error', 'No text found in clipboard')
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
        Alert.alert(
          'Invalid Input',
          'The clipboard content is not a valid Lightning invoice or LNURL'
        )
      }
    } catch {
      Alert.alert('Error', 'Failed to read clipboard content')
    }
  }

  const handleQRCodeScanned = async ({ data }: { data: string }) => {
    setCameraModalVisible(false)

    if (data.toLowerCase().startsWith('lnbc')) {
      // Handle bolt11 invoice
      setPaymentRequest(data)
      setQrModalVisible(true)
    } else if (isLNURL(data)) {
      await handleLNURLInput(data)
    } else {
      Alert.alert(
        'Invalid QR Code',
        'The scanned QR code is not a valid LNURL-withdraw or Lightning invoice'
      )
    }
  }

  const handleCreateInvoice = async () => {
    if (!invoiceAmount || !invoiceDescription) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    const amount = parseInt(invoiceAmount, 10)
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount')
      return
    }

    setIsProcessing(true)
    try {
      let invoice: Invoice

      if (isLNURLMode && lnurlDetails) {
        // Validate amount against LNURL limits
        const amountMillisats = amount * 1000
        if (
          amountMillisats < lnurlDetails.minWithdrawable ||
          amountMillisats > lnurlDetails.maxWithdrawable
        ) {
          throw new Error(
            `Amount must be between ${Math.ceil(lnurlDetails.minWithdrawable / 1000)} and ${Math.floor(lnurlDetails.maxWithdrawable / 1000)} sats`
          )
        }

        // First create a bolt11 invoice
        const bolt11Invoice = (await createInvoice(
          amount,
          invoiceDescription
        )) as Invoice
        if (!bolt11Invoice.payment_request) {
          throw new Error('Failed to create bolt11 invoice')
        }

        // Then request withdraw with the bolt11 invoice
        const response = await requestLNURLWithdrawInvoice(
          lnurlDetails.callback,
          amountMillisats,
          lnurlDetails.k1,
          invoiceDescription,
          bolt11Invoice.payment_request
        )

        if (response.status === 'ERROR') {
          throw new Error(
            response.reason || 'Failed to get invoice from LNURL service'
          )
        }

        // Use the bolt11 invoice we created
        invoice = bolt11Invoice
      } else {
        const bolt11Invoice = (await createInvoice(
          amount,
          invoiceDescription
        )) as Invoice
        invoice = bolt11Invoice
      }

      setPaymentRequest(invoice.payment_request)
      setCurrentAmount(invoiceAmount)
      setCurrentDescription(invoiceDescription)
      setRHash(invoice.r_hash || '')
      setInvoiceStatus('open')
      setQrModalVisible(true)
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create invoice'
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCopyToClipboard = async () => {
    await Clipboard.setStringAsync(paymentRequest)
    Alert.alert('Success', 'Payment request copied to clipboard')
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              New Invoice
            </SSText>
          )
        }}
      />
      <SSMainLayout>
        <SSVStack>
          <View>
            <SSVStack gap="md">
              <SSVStack gap="xs">
                <SSText uppercase>Amount (sats)</SSText>
                <TextInput
                  style={styles.input}
                  value={invoiceAmount}
                  onChangeText={handleAmountChange}
                  placeholder="Enter amount in satoshis"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                />
                <SSText color="muted" size="sm">
                  ≈ {formatNumber(fiatAmount, 2)} {fiatCurrency}
                </SSText>
                {isLNURLMode && lnurlDetails && (
                  <SSText color="muted" size="sm">
                    Available: {Math.floor(lnurlDetails.maxWithdrawable / 1000)}{' '}
                    sats
                  </SSText>
                )}
              </SSVStack>

              <SSVStack style={styles.inputContainer}>
                <SSText uppercase>Description</SSText>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={invoiceDescription}
                  onChangeText={setInvoiceDescription}
                  placeholder="Enter invoice description"
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={3}
                />
              </SSVStack>

              <SSVStack style={styles.actions}>
                <SSHStack gap="sm" style={styles.actionButtons}>
                  <SSButton
                    label="Paste"
                    onPress={handlePasteFromClipboard}
                    variant="outline"
                    style={styles.actionButton}
                  />
                  <SSButton
                    label="Scan QR"
                    onPress={() => setCameraModalVisible(true)}
                    variant="outline"
                    style={styles.actionButton}
                  />
                </SSHStack>

                <SSButton
                  label={isLNURLMode ? 'Withdraw' : 'Create Invoice'}
                  onPress={handleCreateInvoice}
                  variant="secondary"
                  loading={isProcessing}
                  disabled={!isFormValid()}
                  style={styles.button}
                />
                <SSButton
                  label="Cancel"
                  onPress={() => router.back()}
                  variant="ghost"
                  style={styles.button}
                />
              </SSVStack>
            </SSVStack>
          </View>
        </SSVStack>
      </SSMainLayout>

      <SSModal
        visible={qrModalVisible}
        fullOpacity
        onClose={() => setQrModalVisible(false)}
      >
        <ScrollView style={styles.modalScrollView}>
          <SSVStack itemsCenter gap="md" style={styles.modalContent}>
            <SSVStack gap="sm" style={styles.invoiceDetails}>
              <SSText uppercase>Payment Details</SSText>

              <View style={styles.detailsContent}>
                <View style={styles.detailSection}>
                  <SSHStack gap="xs" style={styles.detailRow}>
                    <SSText color="muted" style={styles.detailLabel}>
                      Amount
                    </SSText>
                    <SSHStack gap="xs" style={styles.amountContainer}>
                      <SSText weight="medium">{currentAmount} sats</SSText>
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
                      Description
                    </SSText>
                    <SSText style={styles.detailValue}>
                      {currentDescription}
                    </SSText>
                  </SSHStack>

                  <SSHStack gap="xs" style={styles.detailRow}>
                    <SSText color="muted" style={styles.detailLabel}>
                      Status
                    </SSText>
                    <SSText
                      style={styles.detailValue}
                      color={invoiceStatus === 'settled' ? 'white' : 'muted'}
                    >
                      {invoiceStatus === 'settled'
                        ? 'Paid'
                        : invoiceStatus === 'canceled'
                          ? 'Canceled'
                          : 'Waiting for payment...'}
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
                Payment Request
              </SSText>
              <View style={styles.paymentRequestText}>
                <SSText type="mono" size="sm">
                  {paymentRequest}
                </SSText>
              </View>
            </SSVStack>

            <SSVStack style={styles.modalActions}>
              <SSButton
                label="Copy to Clipboard"
                onPress={handleCopyToClipboard}
                variant="gradient"
                gradientType="special"
              />
            </SSVStack>
          </SSVStack>
        </ScrollView>
      </SSModal>

      <SSModal
        visible={cameraModalVisible}
        fullOpacity
        onClose={() => setCameraModalVisible(false)}
      >
        <SSText color="muted" uppercase>
          Scan QR Code
        </SSText>
        <CameraView
          onBarcodeScanned={handleQRCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          style={styles.camera}
        />
        {!permission?.granted && (
          <SSButton label="Enable Camera Access" onPress={requestPermission} />
        )}
      </SSModal>
    </>
  )
}

const styles = StyleSheet.create({
  mainLayout: {
    paddingTop: 32,
    paddingHorizontal: '5%'
  },
  content: {
    flex: 1,
    gap: 24
  },
  form: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    gap: 16
  },
  inputContainer: {
    gap: 8
  },
  input: {
    backgroundColor: '#242424',
    borderRadius: 3,
    padding: 12,
    color: 'white',
    fontSize: 16
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top'
  },
  actions: {
    gap: 12,
    marginTop: 8
  },
  button: {
    width: '100%'
  },
  modalScrollView: {
    width: '100%',
    maxHeight: '90%'
  },
  modalContent: {
    width: '100%',
    padding: 10
  },
  invoiceDetails: {
    width: '100%',
    gap: 12
  },
  detailsContent: {
    gap: 16
  },
  detailSection: {
    gap: 12
  },
  detailRow: {
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap'
  },
  detailLabel: {
    minWidth: 100,
    fontSize: 14
  },
  detailValue: {
    flex: 1,
    textAlign: 'right'
  },
  amountContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'baseline'
  },
  qrContainer: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16
  },
  paymentRequestContainer: {
    width: '100%',
    gap: 8
  },
  paymentRequestText: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    width: '100%'
  },
  modalActions: {
    gap: 12,
    marginTop: 16,
    width: '100%'
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  scanButton: {
    minWidth: 100
  },
  camera: {
    width: 340,
    height: 340
  },
  actionButtons: {
    width: '100%',
    marginBottom: 8
  },
  actionButton: {
    flex: 1
  }
})
