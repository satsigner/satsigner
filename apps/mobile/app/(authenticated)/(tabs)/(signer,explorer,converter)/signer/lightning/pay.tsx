/* eslint-disable no-console */
import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
import { useFonts } from 'expo-font'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import { useLND } from '@/hooks/useLND'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { Typography } from '@/styles'
import { formatNumber } from '@/utils/format'
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

export default function PayPage() {
  const router = useRouter()
  const { payInvoice, makeRequest, isConnected, verifyConnection } = useLND()
  const typedMakeRequest = makeRequest as MakeRequest
  const [permission, requestPermission] = useCameraPermissions()
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )

  const [fontsLoaded] = useFonts({
    'SF-NS-Mono': require('@/assets/fonts/SF-NS-Mono.ttf')
  })

  const [paymentRequest, setPaymentRequest] = useState('')
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isFetchingDetails, setIsFetchingDetails] = useState(false)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [isLNURLMode, setIsLNURLMode] = useState(false)
  const [decodedInvoice, setDecodedInvoice] = useState<DecodedInvoice | null>(
    null
  )

  // Fetch LNURL details and set minimum amount
  const handleLNURLDetected = useCallback(async (lnurl: string) => {
    try {
      setIsFetchingDetails(true)
      console.log('🔍 Fetching LNURL details for amount population')
      const url = isLNURL(lnurl) ? decodeLNURL(lnurl) : lnurl
      const details = await fetchLNURLPayDetails(url)

      // Convert millisats to sats and set as amount
      const minSats = Math.ceil(details.minSendable / 1000)
      console.log('💰 Setting minimum amount:', minSats, 'sats')
      setAmount(minSats.toString())
    } catch (error) {
      console.error('❌ Failed to fetch LNURL details for amount:', error)
      // Don't show error to user, just don't set the amount
    } finally {
      setIsFetchingDetails(false)
    }
  }, [])

  // Decode a bolt11 invoice
  const decodeInvoice = useCallback(
    async (invoice: string) => {
      try {
        console.log('🔍 Starting invoice decode:', {
          prefix: invoice.substring(0, 10) + '...',
          length: invoice.length,
          timestamp: new Date().toISOString()
        })
        const response = await typedMakeRequest<DecodedInvoice>(
          '/v1/payreq/' + invoice
        )
        console.log('✅ Invoice decoded successfully:', {
          amount: response.num_satoshis,
          description: response.description,
          timestamp: response.timestamp,
          expiry: response.expiry,
          payment_hash: response.payment_hash
        })

        // Update state with decoded invoice
        setDecodedInvoice(response)
        console.log('📝 Updated decodedInvoice state:', {
          hasDecodedInvoice: !!response,
          amount: response.num_satoshis,
          timestamp: new Date().toISOString()
        })

        return response
      } catch (error) {
        console.error('❌ Failed to decode invoice:', {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        })
        setDecodedInvoice(null)
        throw error
      }
    },
    [typedMakeRequest]
  )

  // Update LNURL mode and fetch details when payment request changes
  const handlePaymentRequestChange = useCallback(
    async (text: string) => {
      console.log('📝 Payment request changed:', {
        length: text.length,
        isLNURL: isLNURL(text),
        isBolt11: text.toLowerCase().startsWith('lnbc'),
        isConnected,
        timestamp: new Date().toISOString()
      })

      // Clear previous state
      setPaymentRequest(text)
      const isLNURLInput = isLNURL(text)
      setIsLNURLMode(isLNURLInput)
      setDecodedInvoice(null) // Clear previous decode

      // Verify LND connection before proceeding
      if (!isConnected) {
        console.log('🔌 LND not connected, attempting to verify connection...')
        const isStillConnected = await verifyConnection()
        if (!isStillConnected) {
          console.error('❌ LND not connected, cannot decode invoice')
          Alert.alert(
            'Connection Error',
            'Not connected to LND node. Please check your connection and try again.'
          )
          return
        }
      }

      if (isLNURLInput) {
        console.log('🔍 Detected LNURL payment request')
        // If it's a LNURL and we don't have an amount set, fetch details
        if (!amount) {
          await handleLNURLDetected(text)
        }
      } else if (text.toLowerCase().startsWith('lnbc')) {
        console.log('🔍 Detected bolt11 invoice, decoding automatically...')
        try {
          const decoded = await decodeInvoice(text)
          console.log('✅ Successfully decoded bolt11 invoice:', {
            amount: decoded.num_satoshis,
            description: decoded.description,
            timestamp: decoded.timestamp,
            expiry: decoded.expiry
          })
          // Set amount from decoded invoice
          if (decoded.num_satoshis) {
            console.log(
              '💰 Setting amount from decoded invoice:',
              decoded.num_satoshis
            )
            setAmount(decoded.num_satoshis)
          }
        } catch (error) {
          console.error('❌ Failed to decode bolt11 invoice:', {
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          })
          setDecodedInvoice(null)
        }
      } else {
        console.log('⚠️ Input is neither LNURL nor bolt11 invoice')
        setDecodedInvoice(null)
      }
    },
    [amount, handleLNURLDetected, decodeInvoice, isConnected, verifyConnection]
  )

  // Handle amount change and update fiat value
  const handleAmountChange = useCallback((text: string) => {
    setAmount(text)
  }, [])

  const handleSendPayment = async () => {
    if (!paymentRequest) {
      Alert.alert('Error', 'Please enter a payment request')
      return
    }

    // For bolt11 invoices, ensure we have decoded it
    if (!isLNURLMode) {
      if (!decodedInvoice) {
        console.error('❌ No decoded invoice available')
        Alert.alert('Error', 'Please wait for the invoice to be decoded')
        return
      }
      // Proceed with payment since we already have the decoded invoice
      await processPayment()
    } else {
      // For LNURL, proceed directly to payment
      await processPayment()
    }
  }

  const processPayment = async () => {
    if (!paymentRequest) {
      console.error('❌ No payment request available')
      return
    }

    // For bolt11, ensure we have decoded it
    if (!isLNURLMode && !decodedInvoice) {
      console.error('❌ No decoded invoice available for bolt11 payment')
      Alert.alert('Error', 'Please try sending the payment again')
      return
    }

    console.log('🚀 Starting payment process:', {
      isLNURLMode,
      hasAmount: !!amount,
      hasComment: !!comment,
      hasDecodedInvoice: !!decodedInvoice,
      timestamp: new Date().toISOString()
    })

    setIsProcessing(true)
    const startTime = Date.now()
    try {
      let invoice: string

      if (isLNURLMode) {
        console.log('📝 Processing LNURL payment')
        // Validate amount for LNURL
        if (!amount) {
          console.error('❌ No amount provided for LNURL payment')
          Alert.alert('Error', 'Please enter an amount')
          setIsProcessing(false)
          return
        }

        const amountSats = parseInt(amount, 10)
        if (isNaN(amountSats) || amountSats <= 0) {
          console.error('❌ Invalid amount:', amount)
          Alert.alert('Error', 'Please enter a valid amount')
          setIsProcessing(false)
          return
        }

        console.log('💫 Requesting invoice from LNURL:', {
          amount: amountSats,
          hasComment: !!comment,
          timestamp: new Date().toISOString()
        })

        // Get invoice from LNURL
        const lnurlStartTime = Date.now()
        invoice = await handleLNURLPay(
          paymentRequest,
          amountSats,
          comment || undefined
        )
        console.log('✅ Received invoice from LNURL:', {
          duration: Date.now() - lnurlStartTime,
          timestamp: new Date().toISOString()
        })
      } else {
        console.log('📝 Processing decoded bolt11 invoice:', {
          amount: decodedInvoice?.num_satoshis,
          description: decodedInvoice?.description,
          timestamp: new Date().toISOString()
        })
        invoice = paymentRequest
      }

      console.log('💫 Sending payment to LND:', {
        invoiceLength: invoice.length,
        timestamp: new Date().toISOString()
      })
      const paymentStartTime = Date.now()

      // Pay the invoice
      await payInvoice(invoice)

      console.log('✅ Payment sent successfully:', {
        totalDuration: Date.now() - startTime,
        paymentDuration: Date.now() - paymentStartTime,
        timestamp: new Date().toISOString()
      })

      Alert.alert('Success', 'Payment sent successfully', [
        {
          text: 'OK',
          onPress: () => router.back()
        }
      ])
    } catch (error) {
      console.error('❌ Payment failed:', {
        error,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      })
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to send payment'
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleQRCodeScanned = ({ data }: { data: string }) => {
    setCameraModalVisible(false)
    // Clean the text (remove any whitespace and lightning: prefix)
    const cleanText = data.trim().replace(/^lightning:/i, '')

    // Use the same validation logic as handlePaymentRequestChange
    if (cleanText.toLowerCase().startsWith('lnbc') || isLNURL(cleanText)) {
      console.log('🔍 Processing scanned payment request:', {
        length: cleanText.length,
        isLNURL: isLNURL(cleanText),
        isBolt11: cleanText.toLowerCase().startsWith('lnbc'),
        timestamp: new Date().toISOString()
      })
      handlePaymentRequestChange(cleanText)
    } else {
      console.error('❌ Invalid QR code content:', {
        content: cleanText.substring(0, 20) + '...',
        length: cleanText.length,
        timestamp: new Date().toISOString()
      })
      Alert.alert(
        'Invalid QR Code',
        'The scanned QR code is not a valid Lightning payment request or LNURL'
      )
    }
  }

  const handlePasteFromClipboard = async () => {
    try {
      console.log('📋 Attempting to paste from clipboard')
      const text = await Clipboard.getStringAsync()
      if (!text) {
        console.log('❌ No text in clipboard')
        Alert.alert('Error', 'No text found in clipboard')
        return
      }

      // Clean the text (remove any whitespace)
      const cleanText = text.trim()
      console.log('📋 Clipboard content:', {
        length: cleanText.length,
        isLNURL: isLNURL(cleanText),
        isBolt11: cleanText.toLowerCase().startsWith('lnbc')
      })

      if (cleanText.toLowerCase().startsWith('lnbc') || isLNURL(cleanText)) {
        // Use handlePaymentRequestChange to process the invoice
        // This ensures consistent handling of both paste and manual input
        console.log('🔍 Processing pasted payment request')
        await handlePaymentRequestChange(cleanText)
        console.log('✅ Successfully processed pasted payment request')
      } else {
        console.error('❌ Invalid clipboard content')
        Alert.alert(
          'Invalid Payment Request',
          'The clipboard content is not a valid Lightning payment request or LNURL'
        )
      }
    } catch (error) {
      console.error('❌ Clipboard error:', error)
      Alert.alert('Error', 'Failed to read clipboard content')
    }
  }

  if (!fontsLoaded) {
    return null
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              Send Payment
            </SSText>
          )
        }}
      />
      <SSMainLayout>
        <ScrollView>
          <SSVStack>
            <View>
              <SSVStack gap="xs">
                <SSHStack style={styles.inputHeader}>
                  <SSText uppercase>
                    {isLNURLMode ? 'LNURL' : 'Payment Request'}
                  </SSText>
                  {isFetchingDetails && (
                    <SSHStack gap="xs" style={styles.fetchingDetails}>
                      <SSText color="muted" size="sm">
                        Fetching details...
                      </SSText>
                    </SSHStack>
                  )}
                </SSHStack>

                <TextInput
                  style={[styles.input, styles.textArea, styles.monospaceInput]}
                  value={paymentRequest}
                  onChangeText={handlePaymentRequestChange}
                  placeholder={
                    isLNURLMode
                      ? 'Enter LNURL'
                      : 'Enter Lightning payment request'
                  }
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={6}
                  editable={!isFetchingDetails}
                />

                {decodedInvoice && !isLNURLMode && (
                  <SSVStack gap="sm" style={styles.invoiceDetails}>
                    <SSText uppercase>Payment Details</SSText>

                    <View style={styles.detailsContent}>
                      <View style={styles.detailSection}>
                        <SSHStack gap="xs" style={styles.detailRow}>
                          <SSText color="muted" style={styles.detailLabel}>
                            Amount
                          </SSText>
                          <SSHStack gap="xs" style={styles.amountContainer}>
                            <SSText weight="medium">
                              {decodedInvoice.num_satoshis} sats
                            </SSText>
                            <SSText color="muted" size="sm">
                              ≈{' '}
                              {formatNumber(
                                satsToFiat(Number(decodedInvoice.num_satoshis)),
                                2
                              )}{' '}
                              {fiatCurrency}
                            </SSText>
                          </SSHStack>
                        </SSHStack>

                        {decodedInvoice.description && (
                          <SSHStack gap="xs" style={styles.detailRow}>
                            <SSText color="muted" style={styles.detailLabel}>
                              Description
                            </SSText>
                            <SSText style={styles.detailValue}>
                              {decodedInvoice.description}
                            </SSText>
                          </SSHStack>
                        )}

                        <SSHStack gap="xs" style={styles.detailRow}>
                          <SSText color="muted" style={styles.detailLabel}>
                            Created
                          </SSText>
                          <SSText style={styles.detailValue}>
                            {new Date(
                              Number(decodedInvoice.timestamp) * 1000
                            ).toLocaleString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: true
                            })}
                          </SSText>
                        </SSHStack>

                        <SSHStack gap="xs" style={styles.detailRow}>
                          <SSText color="muted" style={styles.detailLabel}>
                            Expires
                          </SSText>
                          <SSText style={styles.detailValue}>
                            {new Date(
                              Number(decodedInvoice.timestamp) * 1000 +
                                Number(decodedInvoice.expiry) * 1000
                            ).toLocaleString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: true
                            })}
                          </SSText>
                        </SSHStack>
                      </View>

                      <View style={styles.detailSection}>
                        <SSHStack
                          gap="xs"
                          style={[styles.detailRow, styles.hashRow]}
                        >
                          <SSText color="muted" style={styles.detailLabel}>
                            Payment Hash
                          </SSText>
                          <View style={styles.hashContainer}>
                            <SSText
                              size="sm"
                              style={[styles.hashText, styles.monospaceInput]}
                              numberOfLines={1}
                              ellipsizeMode="middle"
                            >
                              {decodedInvoice.payment_hash}
                            </SSText>
                          </View>
                        </SSHStack>
                      </View>
                    </View>
                  </SSVStack>
                )}

                {isLNURLMode && (
                  <>
                    <SSVStack gap="xs">
                      <SSText color="muted">Amount (sats)</SSText>
                      <TextInput
                        style={styles.input}
                        value={amount}
                        onChangeText={handleAmountChange}
                        placeholder="Enter amount in sats"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        editable={!isFetchingDetails}
                      />
                      {amount && !isNaN(Number(amount)) && (
                        <SSHStack gap="xs" style={styles.fiatAmount}>
                          <SSText color="muted" size="sm">
                            ≈ {formatNumber(satsToFiat(Number(amount)), 2)}{' '}
                            {fiatCurrency}
                          </SSText>
                        </SSHStack>
                      )}
                    </SSVStack>

                    <SSVStack gap="xs">
                      <SSText color="muted">Comment (optional)</SSText>
                      <TextInput
                        style={styles.input}
                        value={comment}
                        onChangeText={setComment}
                        placeholder="Enter comment"
                        placeholderTextColor="#666"
                        editable={!isFetchingDetails}
                      />
                    </SSVStack>
                  </>
                )}
              </SSVStack>

              <SSVStack style={styles.actions}>
                <SSHStack gap="sm" style={styles.actionButtons}>
                  <SSButton
                    label="Paste"
                    onPress={handlePasteFromClipboard}
                    variant="outline"
                    style={[styles.actionButton, styles.buttonWithIcon]}
                    disabled={isFetchingDetails}
                  />
                  <SSButton
                    label="Scan QR"
                    onPress={() => setCameraModalVisible(true)}
                    variant="outline"
                    style={[styles.actionButton, styles.buttonWithIcon]}
                    disabled={isFetchingDetails}
                  />
                </SSHStack>

                <SSButton
                  label="Send Payment"
                  onPress={handleSendPayment}
                  variant="secondary"
                  loading={isProcessing || isFetchingDetails}
                  disabled={
                    !paymentRequest.trim() ||
                    (isLNURLMode && !amount) ||
                    (!isLNURLMode && !decodedInvoice) ||
                    isFetchingDetails
                  }
                  style={styles.button}
                />
                <SSButton
                  label="Cancel"
                  onPress={() => router.back()}
                  variant="ghost"
                  style={styles.button}
                  disabled={isFetchingDetails}
                />
              </SSVStack>
            </View>
          </SSVStack>
        </ScrollView>
      </SSMainLayout>

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
    </>
  )
}

const styles = StyleSheet.create({
  inputHeader: {
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  input: {
    backgroundColor: '#242424',
    borderRadius: 3,
    padding: 12,
    color: 'white',
    fontSize: 16
  },
  textArea: {
    height: 180,
    textAlignVertical: 'top'
  },
  monospaceInput: {
    fontFamily: Typography.sfProMono,
    fontSize: 14,
    letterSpacing: 0.5
  },
  actions: {
    gap: 12,
    marginTop: 16
  },
  actionButtons: {
    width: '100%'
  },
  actionButton: {
    flex: 1
  },
  button: {
    width: '100%'
  },
  camera: {
    width: 340,
    height: 340
  },
  buttonWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  buttonIcon: {
    marginRight: 4
  },
  fetchingDetails: {
    alignItems: 'center'
  },
  fiatAmount: {
    marginTop: 4,
    marginLeft: 4
  },
  invoiceDetails: {
    marginTop: 16,
    marginBottom: 16
  },
  detailsTitle: {
    fontSize: 16,
    letterSpacing: 0.5,
    marginBottom: 8
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
  hashRow: {
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  hashContainer: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8
  },
  hashText: {
    opacity: 0.8,
    fontSize: 12,
    textAlign: 'right',
    fontFamily: Typography.sfProMono
  }
})
