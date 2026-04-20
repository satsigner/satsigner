import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSEcashLightningTabs from '@/components/SSEcashLightningTabs'
import SSEcashTokenDetails from '@/components/SSEcashTokenDetails'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useEcashReceive } from '@/hooks/useEcashReceive'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { error, success, warning, white } from '@/styles/colors'
import { type DetectedContent } from '@/utils/contentDetector'
import { formatNumber } from '@/utils/format'
import { getLNURLType } from '@/utils/lnurl'

function getStatusColor(status: string) {
  switch (status) {
    case 'PAID':
    case 'ISSUED':
      return success
    case 'PENDING':
    case 'UNPAID':
      return warning
    case 'EXPIRED':
    case 'CANCELLED':
      return error
    default:
      return white
  }
}

function getStatusText(status: string) {
  switch (status) {
    case 'PENDING':
    case 'UNPAID':
      return t('ecash.quote.pending')
    case 'PAID':
    case 'ISSUED':
      return t('ecash.quote.paid')
    case 'EXPIRED':
      return t('ecash.quote.expired')
    case 'CANCELLED':
      return t('ecash.quote.cancelled')
    default:
      return status || ''
  }
}

export default function EcashReceivePage() {
  const { token: tokenParam, lnurl: lnurlParam } = useLocalSearchParams<{
    token?: string
    lnurl?: string
  }>()
  const [activeTab, setActiveTab] = useState<'ecash' | 'lightning'>('ecash')
  const [amountMode, setAmountMode] = useState<'sats' | 'fiat'>('sats')
  const [localFiatAmount, setLocalFiatAmount] = useState('')
  const [cameraModalVisible, setCameraModalVisible] = useState(false)

  const {
    amount,
    createInvoice,
    decodedToken,
    handleLNURLWithdrawInput,
    handleTokenChange,
    isCreatingQuote,
    isFetchingLNURL,
    isLNURLWithdrawMode,
    isPolling,
    isRedeeming,
    isTokenMintConnected,
    lnurlWithdrawDetails,
    memo,
    mintQuote,
    quoteStatus,
    redeemToken,
    setAmount,
    setMemo,
    stopPolling,
    token,
    tokenMintUrl,
    tokenSpentStatus
  } = useEcashReceive()

  const showMintNotConnectedWarning = !!decodedToken && !isTokenMintConnected
  const showTokenAlreadyClaimedWarning =
    !!decodedToken && isTokenMintConnected && tokenSpentStatus === 'spent'
  const showTokenStatusCheckingNote =
    !!decodedToken && isTokenMintConnected && tokenSpentStatus === 'checking'

  const [fiatCurrency, satsToFiat, btcPrice] = usePriceStore(
    useShallow((state) => [
      state.fiatCurrency,
      state.satsToFiat,
      state.btcPrice
    ])
  )
  const privacyMode = useSettingsStore((state) => state.privacyMode)

  useEffect(
    () => () => {
      stopPolling()
    },
    [stopPolling]
  )

  useEffect(() => {
    if (activeTab !== 'lightning') {
      stopPolling()
    }
  }, [activeTab, stopPolling])

  useEffect(() => {
    if (tokenParam) {
      const tokenValue = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam
      if (tokenValue) {
        setActiveTab('ecash')
        handleTokenChange(tokenValue)
      }
    } else if (lnurlParam) {
      const lnurlValue = Array.isArray(lnurlParam) ? lnurlParam[0] : lnurlParam
      if (lnurlValue) {
        setActiveTab('lightning')
        handleLNURLWithdrawInput(lnurlValue)
      }
    }
    // `handleTokenChange` and `handleLNURLWithdrawInput` are not memoized in
    // `useEcashReceive`, so including them in deps re-runs this effect on
    // every render. When `tokenParam` is set, the effect body calls
    // `handleTokenChange` which toggles `decodedToken` state, causing a
    // re-render and re-firing the effect — a classic "Maximum update depth
    // exceeded" loop. The effect only needs to react to URL param changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenParam, lnurlParam])

  function handleFiatAmountChange(text: string) {
    const cleaned = text.replace(/[^0-9.]/g, '')
    setLocalFiatAmount(cleaned)
    const fiat = Number(cleaned)
    if (!isNaN(fiat) && btcPrice && btcPrice > 0) {
      const sats = Math.round((fiat / btcPrice) * 1e8)
      setAmount(sats > 0 ? sats.toString() : '')
    }
  }

  function handleSwitchToFiat() {
    if (!btcPrice || btcPrice <= 0) {
      return
    }
    if (amount) {
      const fiat = satsToFiat(parseInt(amount, 10))
      setLocalFiatAmount(fiat > 0 ? fiat.toFixed(2) : '')
    }
    setAmountMode('fiat')
  }

  function handleSwitchToSats() {
    setAmountMode('sats')
  }

  async function handlePasteToken() {
    try {
      const clipboardText = await Clipboard.getStringAsync()
      if (!clipboardText) {
        toast.error(t('ecash.error.noTextInClipboard'))
        return
      }
      if (activeTab === 'ecash') {
        handleTokenChange(clipboardText)
        toast.success(t('ecash.success.tokenPasted'))
      } else if (activeTab === 'lightning') {
        const { isLNURL: isLNURLInput, type: lnurlType } =
          getLNURLType(clipboardText)
        if (isLNURLInput && lnurlType === 'withdraw') {
          handleLNURLWithdrawInput(clipboardText)
        } else {
          toast.error(t('ecash.error.invalidLnurlType'))
        }
      }
    } catch {
      toast.error(t('ecash.error.failedToPaste'))
    }
  }

  function handleContentScanned(content: DetectedContent) {
    setCameraModalVisible(false)

    if (activeTab === 'ecash') {
      const cleanData = content.cleaned.replace(/^cashu:/i, '')
      handleTokenChange(cleanData)
      toast.success(t('ecash.success.tokenScanned'))
    } else if (activeTab === 'lightning') {
      const { isLNURL: isLNURLInput, type: lnurlType } = getLNURLType(
        content.cleaned
      )
      if (isLNURLInput && lnurlType === 'withdraw') {
        handleLNURLWithdrawInput(content.cleaned)
      } else {
        toast.error(t('ecash.error.invalidLnurlType'))
      }
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
          <SSEcashLightningTabs
            activeTab={activeTab}
            ecashLabel={t('ecash.receive.ecashTab')}
            lightningLabel={t('ecash.receive.lightningTab')}
            onChange={setActiveTab}
          />
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
                  onPress={() => setCameraModalVisible(true)}
                  variant="subtle"
                  style={{ flex: 1 }}
                />
              </SSHStack>
              {decodedToken && (
                <SSEcashTokenDetails
                  decodedToken={decodedToken}
                  fiatCurrency={fiatCurrency}
                  privacyMode={privacyMode}
                  satsToFiat={satsToFiat}
                  showMint
                  showProofs
                />
              )}
              {showMintNotConnectedWarning && (
                <View style={styles.mintWarning}>
                  <SSText style={styles.mintWarningText}>
                    {t('ecash.warning.mintNotConnected', {
                      mint: tokenMintUrl
                    })}
                  </SSText>
                </View>
              )}
              {showTokenAlreadyClaimedWarning && (
                <View style={styles.mintWarning}>
                  <SSText style={styles.mintWarningText}>
                    {t('ecash.warning.tokenAlreadyClaimed')}
                  </SSText>
                </View>
              )}
              {showTokenStatusCheckingNote && (
                <SSText color="muted" size="xs">
                  {t('ecash.warning.tokenStatusChecking')}
                </SSText>
              )}
              <SSButton
                label={t('ecash.receive.redeemToken')}
                onPress={redeemToken}
                loading={isRedeeming}
                disabled={
                  showMintNotConnectedWarning ||
                  showTokenAlreadyClaimedWarning ||
                  showTokenStatusCheckingNote
                }
                variant="secondary"
                gradientType="special"
              />
            </SSVStack>
          )}
          {activeTab === 'lightning' && (
            <SSVStack gap="md">
              {isLNURLWithdrawMode && lnurlWithdrawDetails && (
                <SSVStack gap="xs" style={styles.lnurlDetails}>
                  <SSText color="muted" size="xs" uppercase>
                    {t('ecash.receive.lnurlWithdrawDetails')}
                  </SSText>
                  <SSVStack gap="xs">
                    <SSHStack gap="xs" style={styles.detailRow}>
                      <SSText color="muted" size="sm">
                        {t('ecash.receive.amountRange')}:
                      </SSText>
                      <SSText size="sm">
                        {privacyMode
                          ? `•••• - •••• ${t('bitcoin.sats')}`
                          : `${formatNumber(
                              Math.ceil(
                                lnurlWithdrawDetails.minWithdrawable / 1000
                              )
                            )} - ${formatNumber(
                              Math.floor(
                                lnurlWithdrawDetails.maxWithdrawable / 1000
                              )
                            )} ${t('bitcoin.sats')}`}
                      </SSText>
                    </SSHStack>
                  </SSVStack>
                </SSVStack>
              )}
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  {t('ecash.receive.amount')} (
                  {amountMode === 'sats' ? t('bitcoin.sats') : fiatCurrency})
                </SSText>
                {amountMode === 'sats' ? (
                  <SSTextInput
                    value={
                      amount
                        ? formatNumber(parseInt(amount, 10)).toString()
                        : ''
                    }
                    onChangeText={(text) =>
                      setAmount(text.replace(/[^0-9]/g, ''))
                    }
                    placeholder="0"
                    keyboardType="numeric"
                    editable={!isFetchingLNURL}
                  />
                ) : (
                  <SSTextInput
                    value={localFiatAmount}
                    onChangeText={handleFiatAmountChange}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    editable={!isFetchingLNURL}
                  />
                )}
                {amountMode === 'sats' ? (
                  <SSText
                    color="muted"
                    size="xs"
                    onPress={
                      btcPrice && btcPrice > 0 && !privacyMode
                        ? handleSwitchToFiat
                        : undefined
                    }
                    style={
                      btcPrice && btcPrice > 0 && !privacyMode
                        ? styles.switchableAmount
                        : undefined
                    }
                  >
                    ≈{' '}
                    {privacyMode
                      ? `•••• ${fiatCurrency}`
                      : amount
                        ? `${formatNumber(satsToFiat(parseInt(amount, 10)), 2)} ${fiatCurrency}`
                        : `0 ${fiatCurrency}`}
                  </SSText>
                ) : (
                  <SSText
                    color="muted"
                    size="xs"
                    onPress={privacyMode ? undefined : handleSwitchToSats}
                    style={privacyMode ? undefined : styles.switchableAmount}
                  >
                    {privacyMode
                      ? `•••• ${t('bitcoin.sats')}`
                      : amount
                        ? `${formatNumber(parseInt(amount, 10))} ${t('bitcoin.sats')}`
                        : `0 ${t('bitcoin.sats')}`}
                  </SSText>
                )}
                {isLNURLWithdrawMode &&
                  lnurlWithdrawDetails &&
                  amount &&
                  !isNaN(Number(amount)) && (
                    <SSText color="muted" size="xs">
                      {Number(amount) * 1000 <
                      lnurlWithdrawDetails.minWithdrawable
                        ? t('ecash.error.amountTooLow')
                        : Number(amount) * 1000 >
                            lnurlWithdrawDetails.maxWithdrawable
                          ? t('ecash.error.amountTooHigh')
                          : ''}
                    </SSText>
                  )}
              </SSVStack>
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  {t('ecash.receive.memo')}
                </SSText>
                <SSTextInput
                  value={memo}
                  onChangeText={setMemo}
                  placeholder={
                    lnurlWithdrawDetails?.defaultDescription ||
                    t('ecash.receive.memoPlaceholder')
                  }
                />
              </SSVStack>
              {!mintQuote ? (
                <SSVStack gap="sm">
                  <SSHStack gap="sm">
                    <SSButton
                      label={t('common.paste')}
                      onPress={handlePasteToken}
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
                  <SSButton
                    label={
                      isLNURLWithdrawMode
                        ? t('ecash.receive.withdraw')
                        : t('ecash.receive.createInvoice')
                    }
                    onPress={createInvoice}
                    loading={isCreatingQuote || isFetchingLNURL}
                    variant="gradient"
                    gradientType="special"
                    disabled={
                      !amount ||
                      isFetchingLNURL ||
                      (isLNURLWithdrawMode &&
                        lnurlWithdrawDetails !== null &&
                        (Number(amount) * 1000 <
                          lnurlWithdrawDetails.minWithdrawable ||
                          Number(amount) * 1000 >
                            lnurlWithdrawDetails.maxWithdrawable))
                    }
                  />
                </SSVStack>
              ) : (
                <SSVStack gap="md">
                  {!isLNURLWithdrawMode && (
                    <View style={styles.qrContainer}>
                      <SSQRCode value={mintQuote.request} size={300} />
                    </View>
                  )}
                  {!isLNURLWithdrawMode && (
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
                  )}
                  <SSVStack gap="none">
                    <SSText style={{ color: getStatusColor(quoteStatus) }}>
                      {getStatusText(quoteStatus)}
                    </SSText>
                    {isPolling && (
                      <SSText color="muted" size="xs">
                        {t('ecash.receive.polling')}
                      </SSText>
                    )}
                    {isLNURLWithdrawMode && (
                      <SSText color="muted" size="sm">
                        {t('ecash.receive.withdrawPending')}
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
        title={t('ecash.scan.title')}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  detailRow: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  lnurlDetails: {
    backgroundColor: Colors.gray[900],
    borderRadius: 4,
    padding: 12
  },
  mintWarning: {
    borderColor: Colors.warning,
    borderRadius: 5,
    borderWidth: 1,
    padding: 10
  },
  mintWarningText: {
    color: Colors.warning
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 20
  },
  switchableAmount: {
    textDecorationLine: 'underline'
  },
  tokenInput: {
    fontFamily: 'monospace',
    fontSize: 14,
    height: 'auto',
    minHeight: 100,
    padding: 10,
    textAlignVertical: 'top'
  }
})
