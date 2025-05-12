import { useState } from 'react'
import { Alert, Dimensions, StyleSheet, TextInput, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import * as Clipboard from 'expo-clipboard'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import { useLND } from '@/hooks/useLND'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { usePriceStore } from '@/store/price'
import { formatNumber } from '@/utils/format'

const screenWidth = Dimensions.get('window').width
const qrCodeSize = Math.min(screenWidth * 0.85, 300) // 85% of screen width, max 300px

type Invoice = {
  payment_request: string
}

export default function InvoicePage() {
  const router = useRouter()
  const { createInvoice } = useLND()
  const { satsToFiat, fiatCurrency } = usePriceStore()

  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [invoiceDescription, setInvoiceDescription] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [qrModalVisible, setQrModalVisible] = useState(false)
  const [paymentRequest, setPaymentRequest] = useState('')
  const [currentAmount, setCurrentAmount] = useState('')
  const [currentDescription, setCurrentDescription] = useState('')

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
      const invoice = (await createInvoice(
        amount,
        invoiceDescription
      )) as Invoice
      setPaymentRequest(invoice.payment_request)
      setCurrentAmount(invoiceAmount)
      setCurrentDescription(invoiceDescription)
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
            <SSVStack gap="xs">
              <SSText color="muted">Amount (sats)</SSText>
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
            </SSVStack>

            <SSVStack style={styles.inputContainer}>
              <SSText color="muted">Description</SSText>
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
              <SSButton
                label="Create Invoice"
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
          </View>
        </SSVStack>
      </SSMainLayout>

      <SSModal
        visible={qrModalVisible}
        fullOpacity
        onClose={() => {
          setQrModalVisible(false)
          router.back()
        }}
      >
        <SSVStack itemsCenter gap="md" style={styles.modalContent}>
          <SSText color="muted" uppercase>
            Payment Request
          </SSText>

          <SSHStack style={styles.invoiceDetails}>
            <SSVStack style={styles.detailRow}>
              <SSText color="muted">Amount</SSText>
              <SSText>{currentAmount} sats</SSText>
            </SSVStack>
            <SSVStack style={styles.detailRow}>
              <SSText color="muted">Description</SSText>
              <SSText>{currentDescription}</SSText>
            </SSVStack>
          </SSHStack>

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
            <SSButton
              label="Close"
              onPress={() => {
                setQrModalVisible(false)
                router.back()
              }}
              variant="outline"
            />
          </SSVStack>
        </SSVStack>
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
  modalContent: {
    width: '100%',
    padding: 20
  },
  invoiceDetails: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    gap: 12
  },
  detailRow: {
    gap: 4
  },
  qrContainer: {
    width: qrCodeSize,
    height: qrCodeSize,
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
  }
})
