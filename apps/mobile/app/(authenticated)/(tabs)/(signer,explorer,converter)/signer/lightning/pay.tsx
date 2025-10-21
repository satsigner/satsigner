import * as Clipboard from 'expo-clipboard'
import { useFonts } from 'expo-font'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSLNURLDetails from '@/components/SSLNURLDetails'
import SSModal from '@/components/SSModal'
import SSPaymentDetails from '@/components/SSPaymentDetails'
import SSText from '@/components/SSText'
import { useLND } from '@/hooks/useLND'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { Typography } from '@/styles'
import { type DecodedInvoice } from '@/types/lightning'
import { type DetectedContent } from '@/utils/contentDetector'
import {
  decodeLNURL,
  fetchLNURLPayDetails,
  handleLNURLPay,
  isLNURL,
  type LNURLPayResponse
} from '@/utils/lnurl'

type MakeRequest = <T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: unknown
    headers?: Record<string, string>
  }
) => Promise<T>

export default function PayPage() {
  const router = useRouter()
  const { paymentRequest: paymentRequestParam, invoice: invoiceParam } =
    useLocalSearchParams()
  const { payInvoice, makeRequest, isConnected, verifyConnection } = useLND()
  const typedMakeRequest = makeRequest as MakeRequest

  const [fontsLoaded] = useFonts({
    'SF-NS-Mono': require('@/assets/fonts/SF-NS-Mono.ttf')
  })

  const [paymentRequest, setPaymentRequest] = useState('')
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isFetchingDetails, setIsFetchingDetails] = useState(false)
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [isLNURLMode, setIsLNURLMode] = useState(false)
  const [lnurlDetails, setLNURLDetails] = useState<LNURLPayResponse | null>(
    null
  )
  const [decodedInvoice, setDecodedInvoice] = useState<DecodedInvoice | null>(
    null
  )

  // Fetch LNURL details and set minimum amount
  const handleLNURLDetected = useCallback(async (lnurl: string) => {
    try {
      setIsFetchingDetails(true)
      const url = isLNURL(lnurl) ? decodeLNURL(lnurl) : lnurl
      const details = await fetchLNURLPayDetails(url)

      // Store LNURL details for display
      setLNURLDetails(details)

      // Convert millisats to sats and set as amount
      const minSats = Math.ceil(details.minSendable / 1000)
      setAmount(minSats.toString())
    } catch (error) {
      setLNURLDetails(null)
      // Don't show error to user, just don't set the amount
    } finally {
      setIsFetchingDetails(false)
    }
  }, [])

  // Decode a bolt11 invoice
  const decodeInvoice = useCallback(
    async (invoice: string) => {
      try {
        const response = await typedMakeRequest<DecodedInvoice>(
          '/v1/payreq/' + invoice
        )

        // Update state with decoded invoice
        setDecodedInvoice(response)

        return response
      } catch (error) {
        setDecodedInvoice(null)
        throw error
      }
    },
    [typedMakeRequest]
  )

  // Update LNURL mode and fetch details when payment request changes
  const handlePaymentRequestChange = useCallback(
    async (text: string) => {
      // Clear previous state
      setPaymentRequest(text)
      const isLNURLInput = isLNURL(text)
      setIsLNURLMode(isLNURLInput)
      setDecodedInvoice(null) // Clear previous decode
      setLNURLDetails(null) // Clear previous LNURL details

      // Verify LND connection before proceeding
      if (!isConnected) {
        const isStillConnected = await verifyConnection()
        if (!isStillConnected) {
          Alert.alert(
            'Connection Error',
            'Not connected to LND node. Please check your connection and try again.'
          )
          return
        }
      }

      if (isLNURLInput) {
        // Always fetch LNURL details when a LNURL is detected
        await handleLNURLDetected(text)
      } else if (text.toLowerCase().startsWith('lnbc')) {
        try {
          const decoded = await decodeInvoice(text)
          // Set amount from decoded invoice
          if (decoded.num_satoshis) {
            setAmount(decoded.num_satoshis)
          }
        } catch (_error) {
          setDecodedInvoice(null)
        }
      } else {
        setDecodedInvoice(null)
      }
    },
    [handleLNURLDetected, decodeInvoice, isConnected, verifyConnection]
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
      return
    }

    // For bolt11, ensure we have decoded it
    if (!isLNURLMode && !decodedInvoice) {
      Alert.alert('Error', 'Please try sending the payment again')
      return
    }

    setIsProcessing(true)
    try {
      let invoice: string

      if (isLNURLMode) {
        // Validate amount for LNURL
        if (!amount) {
          Alert.alert('Error', 'Please enter an amount')
          setIsProcessing(false)
          return
        }

        const amountSats = parseInt(amount, 10)
        if (isNaN(amountSats) || amountSats <= 0) {
          Alert.alert('Error', 'Please enter a valid amount')
          setIsProcessing(false)
          return
        }

        // Get invoice from LNURL
        invoice = await handleLNURLPay(
          paymentRequest,
          amountSats,
          comment || undefined
        )
      } else {
        invoice = paymentRequest
      }

      // Pay the invoice
      await payInvoice(invoice)

      Alert.alert('Success', 'Payment sent successfully', [
        {
          text: 'OK',
          onPress: () => router.back()
        }
      ])
    } catch (error) {
      let errorMessage = 'Failed to send payment'
      if (error instanceof Error) {
        if (
          error.message.includes('404') ||
          error.message.includes('Not Found')
        ) {
          errorMessage =
            'Payment request expired or already paid. Please try again.'
        } else if (error.message.includes('amount')) {
          errorMessage = error.message
        } else {
          errorMessage = error.message
        }
      }

      Alert.alert('Error', errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleContentScanned = (content: DetectedContent) => {
    setCameraModalVisible(false)
    // Clean the text (remove any whitespace and lightning: prefix)
    const cleanText = content.cleaned.replace(/^lightning:/i, '')

    // Use the same validation logic as handlePaymentRequestChange
    if (cleanText.toLowerCase().startsWith('lnbc') || isLNURL(cleanText)) {
      handlePaymentRequestChange(cleanText)
    } else {
      Alert.alert(
        'Invalid QR Code',
        'The scanned QR code is not a valid Lightning payment request or LNURL'
      )
    }
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

      if (cleanText.toLowerCase().startsWith('lnbc') || isLNURL(cleanText)) {
        // Use handlePaymentRequestChange to process the invoice
        // This ensures consistent handling of both paste and manual input
        await handlePaymentRequestChange(cleanText)
      } else {
        Alert.alert(
          'Invalid Payment Request',
          'The clipboard content is not a valid Lightning payment request or LNURL'
        )
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to read clipboard content')
    }
  }

  // Handle payment request parameter from URL (when scanned from other pages)
  useEffect(() => {
    // Check both parameter names (paymentRequest and invoice)
    const paramValue = paymentRequestParam || invoiceParam

    if (paramValue) {
      const paymentRequestValue = Array.isArray(paramValue)
        ? paramValue[0]
        : paramValue

      if (paymentRequestValue) {
        // Clean the text (remove any whitespace and lightning: prefix)
        const cleanText = paymentRequestValue.trim().replace(/^lightning:/i, '')

        if (cleanText.toLowerCase().startsWith('lnbc') || isLNURL(cleanText)) {
          // Process the scanned content
          handlePaymentRequestChange(cleanText)
        }
      }
    }
  }, [paymentRequestParam, invoiceParam, handlePaymentRequestChange])

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
              <SSVStack>
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
                        ? 'Enter LNURL'
                        : 'Enter Lightning payment request'
                    }
                    placeholderTextColor="#666"
                    multiline
                    numberOfLines={6}
                    editable={!isFetchingDetails}
                  />

                  <SSHStack gap="sm" style={styles.actionButtons}>
                    <SSButton
                      label="Paste"
                      onPress={handlePasteFromClipboard}
                      variant="subtle"
                      style={[styles.actionButton, styles.buttonWithIcon]}
                      disabled={isFetchingDetails}
                    />
                    <SSButton
                      label="Scan QR"
                      onPress={() => setCameraModalVisible(true)}
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
                    satsToFiat={satsToFiat}
                  />
                )}
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
                    satsToFiat={satsToFiat}
                  />
                )}
              </SSVStack>
              <SSVStack style={styles.actions}>
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
      <SSCameraModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
        onContentScanned={handleContentScanned}
        context="lightning"
        title="Scan Lightning Payment Request"
      />
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
  }
})
