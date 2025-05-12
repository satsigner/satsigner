import { Stack, useRouter } from 'expo-router'
import {
  StyleSheet,
  View,
  TextInput,
  Alert,
  TouchableOpacity
} from 'react-native'
import { useState } from 'react'
import { CameraView, useCameraPermissions } from 'expo-camera/next'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'

import { useLND } from '@/hooks/useLND'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import SSHStack from '@/layouts/SSHStack'
import SSModal from '@/components/SSModal'
import { t } from '@/locales'

export default function PayPage() {
  const router = useRouter()
  const { payInvoice } = useLND()
  const [permission, requestPermission] = useCameraPermissions()

  const [paymentRequest, setPaymentRequest] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)

  const handleSendPayment = async () => {
    if (!paymentRequest) {
      Alert.alert('Error', 'Please enter a payment request')
      return
    }

    setIsProcessing(true)
    try {
      await payInvoice(paymentRequest)
      Alert.alert('Success', 'Payment sent successfully', [
        {
          text: 'OK',
          onPress: () => router.back()
        }
      ])
    } catch (error) {
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
    // Check if the scanned data is a valid Lightning payment request
    if (data.toLowerCase().startsWith('lnbc')) {
      setPaymentRequest(data)
    } else {
      Alert.alert(
        'Invalid QR Code',
        'The scanned QR code is not a valid Lightning payment request'
      )
    }
  }

  const handlePasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync()
    if (text) {
      if (text.toLowerCase().startsWith('lnbc')) {
        setPaymentRequest(text)
      } else {
        Alert.alert(
          'Invalid Payment Request',
          'The clipboard content is not a valid Lightning payment request'
        )
      }
    }
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
        <SSVStack>
          <View>
            <SSVStack gap="xs">
              <SSHStack style={styles.inputHeader}>
                <SSText color="muted">Payment Request</SSText>
                <SSHStack gap="sm">
                  <TouchableOpacity
                    onPress={handlePasteFromClipboard}
                    style={styles.scanButton}
                  >
                    <Ionicons
                      name="clipboard-outline"
                      size={24}
                      color="white"
                    />
                    <SSText size="sm">Paste</SSText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCameraModalVisible(true)}
                    style={styles.scanButton}
                  >
                    <Ionicons name="scan-outline" size={24} color="white" />
                    <SSText size="sm">Scan</SSText>
                  </TouchableOpacity>
                </SSHStack>
              </SSHStack>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={paymentRequest}
                onChangeText={setPaymentRequest}
                placeholder="Enter Lightning payment request"
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
              />
            </SSVStack>

            <SSVStack style={styles.actions}>
              <SSButton
                label="Send Payment"
                onPress={handleSendPayment}
                variant="secondary"
                loading={isProcessing}
                disabled={!paymentRequest.trim()}
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
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#242424',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 3
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
    marginTop: 16
  },
  button: {
    width: '100%'
  },
  camera: {
    width: 340,
    height: 340
  }
})
