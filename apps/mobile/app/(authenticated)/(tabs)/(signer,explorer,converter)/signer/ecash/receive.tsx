import { getDecodedToken } from '@cashu/cashu-ts'
import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
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
import { type DetectedContent } from '@/utils/contentDetector'
import { type EcashToken } from '@/types/models/Ecash'

export default function EcashReceivePage() {
  const { token: tokenParam } = useLocalSearchParams()
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

  const handleTokenChange = useCallback((text: string) => {
    setToken(text)
    setDecodedToken(null) // Clear previous decode

    const cleanText = text.trim()
    if (!cleanText) return

    if (cleanText.toLowerCase().startsWith('cashu')) {
      try {
        const decoded = getDecodedToken(cleanText)
        setDecodedToken(decoded)
      } catch {
        setDecodedToken(null)
      }
    }
  }, [])

  // Handle token parameter from URL
  useEffect(() => {
    if (tokenParam) {
      const tokenValue = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam
      if (tokenValue) {
        setToken(tokenValue)
        setActiveTab('ecash')
        // Process the token to decode it
        handleTokenChange(tokenValue)
      }
    }
  }, [tokenParam, handleTokenChange])

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
      const quote = await createMintQuote(
        activeMint.url,
        parseInt(amount, 10),
        memo
      )
      setMintQuote(quote)
      setQuoteStatus('PENDING')
      toast.success(t('ecash.success.invoiceCreated'))

      // Start automatic polling for payment status with a small delay
      setTimeout(() => {
        startPolling(async () => {
          if (!activeMint || !quote) return false

          try {
            const status = await checkMintQuote(activeMint.url, quote.quote)
            setQuoteStatus(status)

            if (status === 'PAID' || status === 'ISSUED') {
              await mintProofs(
                activeMint.url,
                parseInt(amount, 10),
                quote.quote
              )
              setMintQuote(null)
              setAmount('')
              setMemo('')
              stopPolling()
              toast.success(t('ecash.success.paymentReceived'))
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
    stopPolling
  ])

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

  const handleContentScanned = useCallback(
    (content: DetectedContent) => {
      setCameraModalVisible(false)
      // Clean the data (remove any whitespace and cashu: prefix)
      const cleanData = content.cleaned.replace(/^cashu:/i, '')
      handleTokenChange(cleanData)
      toast.success(t('ecash.success.tokenScanned'))
    },
    [handleTokenChange]
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
                  <SSVStack gap="none">
                    <SSText style={{ color: getStatusColor(quoteStatus) }}>
                      {getStatusText(quoteStatus)}
                    </SSText>
                    {isPolling && (
                      <SSText color="muted" size="xs">
                        {t('ecash.receive.polling')}
                      </SSText>
                    )}
                  </SSVStack>
                </SSVStack>
              )}
            </SSVStack>
          )}
        </SSVStack>
      </ScrollView>
      <SSCameraModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
        onContentScanned={handleContentScanned}
        context="ecash"
        title="Scan Ecash Token"
      />
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
  }
})
