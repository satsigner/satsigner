import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSAmountInput from '@/components/SSAmountInput'
import SSButton from '@/components/SSButton'
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
import { usePriceStore } from '@/store/price'

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

export default function EcashSendPage() {
  const [activeTab, setActiveTab] = useState<'ecash' | 'lightning'>('ecash')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [invoice, setInvoice] = useState('')
  const [generatedToken, setGeneratedToken] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isMelting, setIsMelting] = useState(false)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()
  const [decodedInvoice, setDecodedInvoice] = useState<DecodedInvoice | null>(
    null
  )
  const [isDecoding, setIsDecoding] = useState(false)

  const { activeMint, sendEcash, createMeltQuote, meltProofs, proofs } =
    useEcash()
  const { makeRequest, isConnected, verifyConnection } = useLND()
  const typedMakeRequest = makeRequest as MakeRequest
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )

  const handleGenerateToken = useCallback(async () => {
    if (!amount || amount.trim() === '') {
      toast.error(t('ecash.error.invalidAmount'))
      return
    }

    const amountNum = parseInt(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error(t('ecash.error.invalidAmount'))
      return
    }

    if (!activeMint) {
      toast.error('No mint connected')
      return
    }

    if (proofs.length === 0) {
      toast.error('No tokens available to send')
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
      return
    }

    if (!activeMint) {
      toast.error('No mint connected')
      return
    }

    if (proofs.length === 0) {
      toast.error('No tokens available to melt')
      return
    }

    setIsMelting(true)
    try {
      const quote = await createMeltQuote(activeMint.url, invoice)
      await meltProofs(activeMint.url, quote, proofs)
      setInvoice('')
    } catch {
      toast.error('Failed to melt tokens')
    } finally {
      setIsMelting(false)
    }
  }, [invoice, activeMint, createMeltQuote, meltProofs, proofs])

  // Decode a bolt11 invoice
  const decodeInvoice = useCallback(
    async (invoice: string) => {
      try {
        setIsDecoding(true)
        const response = await typedMakeRequest<DecodedInvoice>(
          '/v1/payreq/' + invoice
        )
        setDecodedInvoice(response)
        return response
      } catch (error) {
        setDecodedInvoice(null)
        throw error
      } finally {
        setIsDecoding(false)
      }
    },
    [typedMakeRequest]
  )

  // Handle invoice input changes and auto-decode
  const handleInvoiceChange = useCallback(
    async (text: string) => {
      setInvoice(text)
      setDecodedInvoice(null) // Clear previous decode

      // Clean the text and check if it's a valid invoice
      const cleanText = text.trim()
      if (!cleanText) return

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

      // Auto-decode bolt11 invoices
      if (cleanText.toLowerCase().startsWith('lnbc')) {
        try {
          const decoded = await decodeInvoice(cleanText)
          // Auto-populate amount from decoded invoice
          if (decoded.num_satoshis) {
            setAmount(decoded.num_satoshis)
          }
        } catch (error) {
          setDecodedInvoice(null)
        }
      }
    },
    [isConnected, verifyConnection, decodeInvoice]
  )

  const handlePasteInvoice = useCallback(async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync()
      if (clipboardText) {
        await handleInvoiceChange(clipboardText)
        toast.success('Invoice pasted from clipboard')
      } else {
        toast.error('No text found in clipboard')
      }
    } catch (error) {
      toast.error('Failed to paste from clipboard')
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
      toast.success('Invoice scanned successfully')
    },
    [handleInvoiceChange]
  )

  const handleCopyToken = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(generatedToken)
      toast.success(t('common.copiedToClipboard'))
    } catch (error) {
      toast.error('Failed to copy to clipboard')
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
                  value={parseInt(amount) || 0}
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
                  placeholder="lnbc..."
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
                {decodedInvoice && (
                  <SSPaymentDetails decodedInvoice={decodedInvoice} />
                )}
              </SSVStack>
              <SSButton
                label={t('ecash.send.meltTokens')}
                onPress={handleMeltTokens}
                loading={isMelting}
                variant="gradient"
                gradientType="special"
              />
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
  }
})
