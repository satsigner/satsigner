import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions
} from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSAmountInput from '@/components/SSAmountInput'
import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSEcashLightningTabs from '@/components/SSEcashLightningTabs'
import SSEcashMintSelector from '@/components/SSEcashMintSelector'
import SSLNURLDetails from '@/components/SSLNURLDetails'
import SSPaymentDetails from '@/components/SSPaymentDetails'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { ANIMATED_QR_INTERVAL_MS, useEcashSend } from '@/hooks/useEcashSend'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors, Sizes } from '@/styles'
import { type DetectedContent } from '@/utils/contentDetector'

export default function EcashSendPage() {
  const { invoice: invoiceParam } = useLocalSearchParams()
  const [activeTab, setActiveTab] = useState<'ecash' | 'lightning'>('ecash')
  const [cameraModalVisible, setCameraModalVisible] = useState(false)

  const {
    activeAccount,
    amount,
    animatedQR,
    animationRef,
    comment,
    currentChunkIndex,
    decodedInvoice,
    emitNFC,
    generatedToken,
    generateToken,
    getQRValue,
    getTokenURFragments,
    handleInvoiceChange,
    invoice,
    isEmitting,
    isFetchingLNURL,
    isGenerating,
    isLNURLMode,
    isMelting,
    lastUpdateRef,
    lnurlDetails,
    meltTokens,
    memo,
    mintProofs,
    mints,
    nfcHardwareSupported,
    proofs,
    selectedMint,
    setAmount,
    setAnimatedQR,
    setComment,
    setCurrentChunkIndex,
    setMemo,
    setSelectedMint,
    setTokenVersion,
    statusMessage,
    tokenVersion
  } = useEcashSend()

  const [fiatCurrency, btcPrice, satsToFiat] = usePriceStore(
    useShallow((state) => [
      state.fiatCurrency,
      state.btcPrice,
      state.satsToFiat
    ])
  )
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const { width } = useWindowDimensions()
  const qrSize = Math.floor(width * 0.88)

  useEffect(() => {
    if (invoiceParam) {
      const invoiceValue = Array.isArray(invoiceParam)
        ? invoiceParam[0]
        : invoiceParam
      if (invoiceValue) {
        setActiveTab('lightning')
        handleInvoiceChange(invoiceValue)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceParam])

  const chunks = getTokenURFragments()
  const totalChunks = chunks.length
  const isMultiPart = totalChunks > 1

  useEffect(() => {
    if (!animatedQR || !isMultiPart) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      setCurrentChunkIndex(0)
      return
    }

    const animate = (timestamp: number) => {
      if (timestamp - lastUpdateRef.current >= ANIMATED_QR_INTERVAL_MS) {
        setCurrentChunkIndex((prev) => (prev + 1) % totalChunks)
        lastUpdateRef.current = timestamp
      }
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [
    animatedQR,
    isMultiPart,
    totalChunks,
    animationRef,
    lastUpdateRef,
    setCurrentChunkIndex
  ])

  async function handlePasteInvoice() {
    try {
      const clipboardText = await Clipboard.getStringAsync()
      if (clipboardText) {
        await handleInvoiceChange(clipboardText)
        toast.success(t('ecash.success.invoicePasted'))
      } else {
        toast.error(t('ecash.error.noTextInClipboard'))
      }
    } catch {
      toast.error(t('ecash.error.failedToPaste'))
    }
  }

  function handleContentScanned(content: DetectedContent) {
    setCameraModalVisible(false)
    const cleanData = content.cleaned.replace(/^lightning:/i, '')
    handleInvoiceChange(cleanData)
    toast.success(t('ecash.success.invoiceScanned'))
  }

  async function handleCopyToken() {
    try {
      await Clipboard.setStringAsync(generatedToken)
      toast.success(t('common.copiedToClipboard'))
    } catch {
      toast.error(t('ecash.error.failedToCopy'))
    }
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSVStack gap="none" itemsCenter>
              <SSText uppercase>{t('ecash.send.title')}</SSText>
              {activeAccount && (
                <SSText size="xs" color="muted">
                  {activeAccount.name}
                </SSText>
              )}
            </SSVStack>
          )
        }}
      />
      <ScrollView>
        <SSVStack gap="lg" style={{ paddingBottom: 60 }}>
          <SSEcashLightningTabs
            activeTab={activeTab}
            ecashLabel={t('ecash.send.ecashTab')}
            lightningLabel={t('ecash.send.lightningTab')}
            onChange={setActiveTab}
          />
          {activeTab === 'ecash' && (
            <SSVStack gap="md">
              <SSEcashMintSelector
                mints={mints}
                selectedMint={selectedMint}
                onSelect={setSelectedMint}
                proofs={proofs}
              />
              <SSVStack gap="xs">
                <SSText size="xs" uppercase>
                  {t('ecash.send.amount')}
                </SSText>
                <SSAmountInput
                  value={parseInt(amount, 10) || 0}
                  onValueChange={(value) => setAmount(value.toString())}
                  min={0}
                  max={mintProofs.reduce((acc, proof) => acc + proof.amount, 0)}
                  remainingSats={mintProofs.reduce(
                    (acc, proof) => acc + proof.amount,
                    0
                  )}
                  fiatCurrency={fiatCurrency}
                  btcPrice={btcPrice}
                  privacyMode={privacyMode}
                  satsToFiat={satsToFiat}
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
                onPress={generateToken}
                loading={isGenerating}
                variant="gradient"
                gradientType="special"
              />

              {generatedToken && (
                <SSVStack gap="sm">
                  <SSHStack gap="sm">
                    <Pressable
                      onPress={() => setTokenVersion('v4')}
                      style={[
                        styles.qrToggleTab,
                        tokenVersion === 'v4'
                          ? styles.qrToggleTabActive
                          : styles.qrToggleTabInactive
                      ]}
                    >
                      <SSText
                        center
                        uppercase
                        weight="medium"
                        style={{
                          color:
                            tokenVersion === 'v4'
                              ? Colors.white
                              : Colors.gray[50]
                        }}
                      >
                        {t('ecash.send.tokenV4')}
                      </SSText>
                    </Pressable>
                    <Pressable
                      onPress={() => setTokenVersion('v3')}
                      style={[
                        styles.qrToggleTab,
                        tokenVersion === 'v3'
                          ? styles.qrToggleTabActive
                          : styles.qrToggleTabInactive
                      ]}
                    >
                      <SSText
                        center
                        uppercase
                        weight="medium"
                        style={{
                          color:
                            tokenVersion === 'v3'
                              ? Colors.white
                              : Colors.gray[50]
                        }}
                      >
                        {t('ecash.send.tokenV3')}
                      </SSText>
                    </Pressable>
                  </SSHStack>
                  <SSVStack gap="xs" itemsCenter>
                    <SSQRCode
                      value={getQRValue(chunks)}
                      size={qrSize}
                      ecl={animatedQR && isMultiPart ? 'M' : 'H'}
                    />
                    <SSText color="muted" size="xs" style={styles.chunkCounter}>
                      {animatedQR && isMultiPart
                        ? `${currentChunkIndex + 1} / ${totalChunks}`
                        : ''}
                    </SSText>
                    {isMultiPart && (
                      <SSHStack gap="sm">
                        <Pressable
                          onPress={() => setAnimatedQR(false)}
                          style={[
                            styles.qrToggleTab,
                            animatedQR
                              ? styles.qrToggleTabInactive
                              : styles.qrToggleTabActive
                          ]}
                        >
                          <SSText
                            center
                            uppercase
                            weight="medium"
                            style={{
                              color: animatedQR ? Colors.gray[50] : Colors.white
                            }}
                          >
                            {t('ecash.send.staticQR')}
                          </SSText>
                        </Pressable>
                        <Pressable
                          onPress={() => setAnimatedQR(true)}
                          style={[
                            styles.qrToggleTab,
                            animatedQR
                              ? styles.qrToggleTabActive
                              : styles.qrToggleTabInactive
                          ]}
                        >
                          <SSText
                            center
                            uppercase
                            weight="medium"
                            style={{
                              color: animatedQR ? Colors.white : Colors.gray[50]
                            }}
                          >
                            {t('ecash.send.animatedQR')}
                          </SSText>
                        </Pressable>
                      </SSHStack>
                    )}
                  </SSVStack>
                  <SSText color="muted" size="xs" uppercase>
                    {t('ecash.send.generatedToken')}
                  </SSText>
                  <SSTextInput
                    value={generatedToken}
                    multiline
                    editable={false}
                    style={styles.tokenInput}
                  />
                  <SSHStack gap="sm">
                    <SSButton
                      label={t('common.copy')}
                      onPress={handleCopyToken}
                      variant="subtle"
                      style={{ flex: 1 }}
                    />
                    <SSButton
                      label={t('common.emitNFC')}
                      onPress={emitNFC}
                      variant="subtle"
                      loading={isEmitting}
                      disabled={!nfcHardwareSupported || !generatedToken}
                      style={{ flex: 1 }}
                    />
                  </SSHStack>
                </SSVStack>
              )}
            </SSVStack>
          )}
          {activeTab === 'lightning' && (
            <SSVStack gap="md">
              <SSEcashMintSelector
                mints={mints}
                selectedMint={selectedMint}
                onSelect={setSelectedMint}
                proofs={proofs}
              />
              <SSVStack gap="sm">
                <SSText uppercase>{t('ecash.send.lightningInvoice')}</SSText>
                <SSTextInput
                  value={invoice}
                  onChangeText={handleInvoiceChange}
                  placeholder={isLNURLMode ? 'lightning:LNURL1...' : 'lnbc...'}
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
                    onPress={() => setCameraModalVisible(true)}
                    variant="subtle"
                    style={{ flex: 1 }}
                  />
                </SSHStack>

                {decodedInvoice && !isLNURLMode && (
                  <SSPaymentDetails
                    decodedInvoice={decodedInvoice}
                    fiatCurrency={fiatCurrency}
                    privacyMode={privacyMode}
                    satsToFiat={satsToFiat}
                  />
                )}

                {isLNURLMode && (
                  <SSLNURLDetails
                    lnurlDetails={lnurlDetails}
                    isFetching={isFetchingLNURL}
                    showCommentInfo
                    amount={amount}
                    onAmountChange={setAmount}
                    comment={comment}
                    onCommentChange={setComment}
                    inputStyles={styles.input}
                    fiatCurrency={fiatCurrency}
                    privacyMode={privacyMode}
                    satsToFiat={satsToFiat}
                  />
                )}
              </SSVStack>
              <SSButton
                label={t('ecash.send.meltTokens')}
                onPress={meltTokens}
                loading={isMelting || isFetchingLNURL}
                variant="gradient"
                gradientType="special"
              />

              {statusMessage && (
                <SSText color="muted" size="sm">
                  {statusMessage}
                </SSText>
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
        title={t('ecash.send.scanLightningInvoice')}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  chunkCounter: {
    height: 16
  },
  input: {
    backgroundColor: Colors.gray[850],
    borderRadius: 3,
    color: 'white',
    fontSize: 16,
    padding: 12
  },
  invoiceInput: {
    fontFamily: 'monospace',
    fontSize: 12,
    height: 'auto',
    padding: 10
  },
  qrToggleTab: {
    alignItems: 'center',
    borderRadius: Sizes.button.borderRadius,
    flex: 1,
    height: Sizes.button.height,
    justifyContent: 'center'
  },
  qrToggleTabActive: {
    borderColor: Colors.gray[75],
    borderWidth: 1
  },
  qrToggleTabInactive: {
    backgroundColor: Colors.gray[800]
  },
  tokenInput: {
    fontFamily: 'monospace',
    fontSize: 12,
    height: 'auto',
    minHeight: 100,
    padding: 10,
    textAlignVertical: 'top'
  }
})
