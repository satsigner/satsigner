import { getDecodedToken } from '@cashu/cashu-ts'
import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
import { Stack } from 'expo-router'
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSEcashTokenDetails from '@/components/SSEcashTokenDetails'
import SSModal from '@/components/SSModal'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type EcashToken } from '@/types/models/Ecash'

export default function EcashReceivePage() {
  const [activeTab, setActiveTab] = useState<'ecash' | 'lightning'>('ecash')
  const [token, setToken] = useState('')
  const [decodedToken, setDecodedToken] = useState<EcashToken | null>(null)
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [mintQuote, setMintQuote] = useState<any>(null)
  const [quoteStatus, setQuoteStatus] = useState<string>('')
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [isCreatingQuote, setIsCreatingQuote] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()

  const {
    activeMint,
    receiveEcash,
    createMintQuote,
    checkMintQuote,
    mintProofs
  } = useEcash()

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
      } catch {
      // Error handling is done in the hook
    } finally {
      setIsRedeeming(false)
    }
  }, [token, activeMint, receiveEcash])

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
      const quote = await createMintQuote(activeMint.url, parseInt(amount, 10))
      setMintQuote(quote)
      setQuoteStatus('PENDING')
      toast.success(t('ecash.success.invoiceCreated'))
      } catch {
      // Error handling is done in the hook
    } finally {
      setIsCreatingQuote(false)
    }
  }, [amount, activeMint, createMintQuote])

  const handleCheckPayment = useCallback(async () => {
    if (!mintQuote || !activeMint) return

    setIsPolling(true)
    try {
      const status = await checkMintQuote(activeMint.url, mintQuote.quote)
      setQuoteStatus(status)

      if (status === 'PAID') {
        await mintProofs(activeMint.url, parseInt(amount, 10), mintQuote.quote)
        setMintQuote(null)
        setAmount('')
        setMemo('')
      }
      } catch {
      // Error handling is done in the hook
    } finally {
      setIsPolling(false)
    }
  }, [mintQuote, activeMint, checkMintQuote, mintProofs, amount])

  // Handle token input changes and auto-decode
  const handleTokenChange = useCallback((text: string) => {
    setToken(text)
    setDecodedToken(null) // Clear previous decode

    // Clean the text and check if it's a valid token
    const cleanText = text.trim()
    if (!cleanText) return

    // Check if it's a cashu token (starts with cashu)
    if (cleanText.toLowerCase().startsWith('cashu')) {
      try {
        const decoded = getDecodedToken(cleanText)
        setDecodedToken(decoded)
      } catch {
        setDecodedToken(null)
      }
    }
  }, [])

  const handlePasteToken = useCallback(async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync()
      if (clipboardText) {
        await handleTokenChange(clipboardText)
        toast.success(t('ecash.success.tokenPasted'))
      } else {
        toast.error(t('ecash.error.noTextInClipboard'))
      }
      } catch {
      toast.error(t('ecash.error.failedToPaste'))
    }
  }, [handleTokenChange])

  const handleScanToken = () => {
    setCameraModalVisible(true)
  }

  const handleQRCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      setCameraModalVisible(false)
      // Clean the data (remove any whitespace and cashu: prefix)
      const cleanData = data.trim().replace(/^cashu:/i, '')
      handleTokenChange(cleanData)
      toast.success(t('ecash.success.tokenScanned'))
    },
    [handleTokenChange]
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return '#FFA500'
      case 'PAID':
        return '#00FF00'
      case 'EXPIRED':
        return '#FF0000'
      case 'CANCELLED':
        return '#FF0000'
      default:
        return '#FFFFFF'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING':
        return t('ecash.quote.pending')
      case 'PAID':
        return t('ecash.quote.paid')
      case 'EXPIRED':
        return t('ecash.quote.expired')
      case 'CANCELLED':
        return t('ecash.quote.cancelled')
      default:
        return ''
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

          {/* Ecash Tab Content */}
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

          {/* Lightning Tab Content */}
          {activeTab === 'lightning' && (
            <SSVStack gap="md">
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  {t('ecash.receive.amount')}
                </SSText>
                <SSTextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </SSVStack>
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  {t('ecash.receive.memo')}
                </SSText>
                <SSTextInput
                  value={memo}
                  onChangeText={setMemo}
                  placeholder={t('ecash.receive.memoPlaceholder')}
                />
              </SSVStack>

              {!mintQuote ? (
                <SSButton
                  label={t('ecash.receive.createInvoice')}
                  onPress={handleCreateInvoice}
                  loading={isCreatingQuote}
                  variant="gradient"
                  gradientType="special"
                />
              ) : (
                <SSVStack gap="md">
                  {/* Display Lightning Invoice */}
                  <View style={styles.qrContainer}>
                    <SSQRCode value={mintQuote.request} size={300} />
                  </View>
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

                  {/* Quote Status */}
                  <SSVStack gap="sm">
                    <SSText color="muted" uppercase>
                      {t('ecash.receive.status')}
                    </SSText>
                    <SSText style={{ color: getStatusColor(quoteStatus) }}>
                      {getStatusText(quoteStatus)}
                    </SSText>
                  </SSVStack>

                  {quoteStatus === 'PENDING' && (
                    <SSButton
                      label={t('ecash.receive.checkPayment')}
                      onPress={handleCheckPayment}
                      loading={isPolling}
                      variant="outline"
                    />
                  )}
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
  }
})
