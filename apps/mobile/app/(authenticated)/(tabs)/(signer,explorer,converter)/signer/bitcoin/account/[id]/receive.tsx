import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, TextInput } from 'react-native'
import { KeychainKind, Psbt } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { signTransaction } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSEllipsisAnimation from '@/components/SSEllipsisAnimation'
import SSLoader from '@/components/SSLoader'
import SSNumberInput from '@/components/SSNumberInput'
import SSQRCode from '@/components/SSQRCode'
import SSSuccessCheckAnimation from '@/components/SSSuccessCheckAnimation'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { DUST_LIMIT, SATS_PER_BITCOIN } from '@/constants/btc'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import useGetFirstUnusedAddress from '@/hooks/useGetFirstUnusedAddress'
import { useNFCEmitter } from '@/hooks/useNFCEmitter'
import useNostrSync from '@/hooks/useNostrSync'
import { useNow } from '@/hooks/useNow'
import {
  usePayjoinReceiver,
  walletCanContributeToPayjoin
} from '@/hooks/usePayjoinReceiver'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type Label } from '@/types/bips/329'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { type PayjoinSession } from '@/types/payjoin'
import { formatPayjoinExpiringLabel } from '@/utils/payjoinExpiry'
import { preparePayjoinPsbtForWalletSign } from '@/utils/payjoinSign'
import { appendParamsToPayjoinUri, parsePayjoinUri } from '@/utils/payjoinUri'

function amountSatsFromPayjoinSession(
  session?: PayjoinSession | null
): number | undefined {
  if (!session) {
    return undefined
  }
  if (session.amountSats && session.amountSats > 0) {
    return session.amountSats
  }
  const parsed = parsePayjoinUri(session.uri)
  const amountBtc = parsed.params?.amountBtc
  if (amountBtc && amountBtc > 0) {
    return Math.round(amountBtc * SATS_PER_BITCOIN)
  }
  return undefined
}

function labelFromPayjoinSession(
  session?: PayjoinSession | null
): string | undefined {
  if (!session) {
    return undefined
  }
  if (session.label) {
    return session.label
  }
  return parsePayjoinUri(session.uri).params?.label
}

export default function Receive() {
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const router = useRouter()

  const [account, setAddrLabel] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((account) => account.id === id),
      state.setAddrLabel
    ])
  )
  const wallet = useGetAccountWallet(id!)
  const { sendLabelsToNostr } = useNostrSync()
  // Hydrate amount/label from a persisted session before the receiver hook
  // runs — otherwise a remount with empty fields clears session.amountSats.
  const existingPayjoinSession = id
    ? usePayjoinSessionsStore.getState().getActiveReceiverSession(id)
    : undefined

  const [addressData, setAddressData] = useState<{
    localAddress?: string
    localAddressNumber?: number
    localAddressQR?: string
    localAddressPath?: string
  }>({})

  const { localAddress, localAddressNumber, localAddressQR, localAddressPath } =
    addressData
  const [localCustomAmount, setLocalCustomAmount] = useState<string>(() => {
    const sats = amountSatsFromPayjoinSession(existingPayjoinSession)
    return sats ? String(sats) : String(DUST_LIMIT)
  })
  const [localFiatAmount, setLocalFiatAmount] = useState<string>()
  const [amountMode, setAmountMode] = useState<'sats' | 'fiat'>('sats')
  const [localLabel, setLocalLabel] = useState<string>(() =>
    labelFromPayjoinSession(existingPayjoinSession)
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [includeLabel, setIncludeLabel] = useState(true)
  const [includeAmount] = useState(true)
  const [includeBitcoinPrefix, setIncludeBitcoinPrefix] = useState(true)
  const [includePayjoin, setIncludePayjoin] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isManualAddress, setIsManualAddress] = useState(false)
  // Distinguishes "user turned Payjoin off" from "we auto-disabled while UTXOs
  // were still empty on first paint" so we can re-enable once coins appear.
  const userSetPayjoinRef = useRef(false)

  const [payjoinEnabled, setPayjoinEnabled] = useSettingsStore(
    useShallow((state) => [state.payjoinEnabled, state.setPayjoinEnabled])
  )

  const accountUtxos = account?.utxos ?? []
  const canContributePayjoin = walletCanContributeToPayjoin(accountUtxos)

  const {
    isHardwareSupported: nfcHardwareSupported,
    isEmitting,
    emitNFCTag,
    cancelNFCScan
  } = useNFCEmitter()

  const [fiatCurrency, btcPrice, satsToFiat] = usePriceStore(
    useShallow((state) => [
      state.fiatCurrency,
      state.btcPrice,
      state.satsToFiat
    ])
  )

  const saveLabelTimeoutRef = useRef<NodeJS.Timeout>(undefined)

  function formatAddressInGroups(address: string): string {
    return (address.match(/(.{1,4})/g) || []).join(' ')
  }

  useEffect(
    () => () => {
      if (saveLabelTimeoutRef.current) {
        clearTimeout(saveLabelTimeoutRef.current)
      }
    },
    []
  )

  const amountSatsForPayjoin =
    includeAmount &&
    localCustomAmount &&
    Number(localCustomAmount) > 0 &&
    Number(localCustomAmount) <= 2_100_000_000_000_000
      ? Number(localCustomAmount)
      : undefined

  const signPayjoinPsbt = useCallback(
    (psbtBase64: string) => {
      if (!wallet) {
        return psbtBase64
      }
      const prepared = preparePayjoinPsbtForWalletSign({
        getPrevTxHex: (txid) => wallet.getTx(txid),
        psbtBase64,
        utxos: accountUtxos
      })
      const proposal = new Psbt(prepared)
      signTransaction(proposal, wallet)
      return proposal.toBase64()
    },
    [accountUtxos, wallet]
  )

  const {
    canContribute,
    canUsePayjoin,
    payjoinUri,
    session: payjoinSession,
    statusLabelKey,
    negotiating: payjoinNegotiating
  } = usePayjoinReceiver({
    account,
    accountId: id!,
    address:
      includePayjoin && payjoinEnabled && canContributePayjoin
        ? localAddress
        : undefined,
    amountSats: amountSatsForPayjoin,
    label: includeLabel ? localLabel : undefined,
    signPsbt: signPayjoinPsbt,
    utxos: accountUtxos
  })

  const nowMs = useNow()
  const payjoinExpiringLabel = formatPayjoinExpiringLabel(
    payjoinSession?.expiresAt,
    nowMs
  )
  const payjoinCompleted = payjoinSession?.status === 'completed'
  const celebratedPayjoinIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!canContribute) {
      if (includePayjoin) {
        setIncludePayjoin(false)
      }
      return
    }
    // UTXOs often arrive after mount — restore Payjoin unless the user opted out.
    if (!userSetPayjoinRef.current && payjoinEnabled && !includePayjoin) {
      setIncludePayjoin(true)
    }
  }, [canContribute, includePayjoin, payjoinEnabled])

  useEffect(() => {
    if (!payjoinCompleted || !payjoinSession?.id) {
      return
    }
    if (celebratedPayjoinIdRef.current === payjoinSession.id) {
      return
    }
    celebratedPayjoinIdRef.current = payjoinSession.id
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    toast.success(t('receive.payjoin.completed.toast'))
  }, [payjoinCompleted, payjoinSession?.id])

  // Keep amount/label fields in sync with the active session / BIP21 URI
  // (e.g. remount, resume, or amount only present on the URI).
  useEffect(() => {
    if (!payjoinSession) {
      return
    }
    const sats = amountSatsFromPayjoinSession(payjoinSession)
    if (sats && (!localCustomAmount || Number(localCustomAmount) <= 0)) {
      setLocalCustomAmount(String(sats))
    }
    const sessionLabel = labelFromPayjoinSession(payjoinSession)
    if (sessionLabel && !localLabel) {
      setLocalLabel(sessionLabel)
    }
  }, [
    localCustomAmount,
    localLabel,
    payjoinSession,
    payjoinSession?.amountSats,
    payjoinSession?.id,
    payjoinSession?.label,
    payjoinSession?.uri
  ])

  const localFinalAddressQR = useMemo(() => {
    // Prefer any live session URI (includes pj=) while Payjoin is on — even if
    // canUsePayjoin briefly lags — so the QR does not snap to a plain address.
    const sessionMatchesAddress =
      !localAddress ||
      !payjoinSession?.address ||
      payjoinSession.address === localAddress
    const sessionUri =
      includePayjoin && payjoinEnabled && sessionMatchesAddress
        ? payjoinUri ||
          (payjoinSession?.status !== 'expired'
            ? payjoinSession?.uri
            : undefined)
        : undefined

    if (sessionUri) {
      // Session resume used to ignore Label/amount toggles; rewrite BIP21
      // extras on the displayed URI so the toggle is immediate.
      let uri = sessionUri
      try {
        uri = appendParamsToPayjoinUri(sessionUri, {
          amountSats: amountSatsForPayjoin,
          label: includeLabel ? localLabel : undefined
        })
      } catch {
        uri = sessionUri
      }
      if (!includeBitcoinPrefix && uri.toLowerCase().startsWith('bitcoin:')) {
        uri = uri.substring(8)
      }
      return uri
    }

    if (!localAddressQR) {
      return ''
    }

    const queryParts: string[] = []

    if (amountSatsForPayjoin !== undefined) {
      const amountInBTC = amountSatsForPayjoin / 100_000_000
      const formattedAmount = amountInBTC.toFixed(8).replace(/\.?0+$/, '')
      queryParts.push(`amount=${encodeURIComponent(formattedAmount)}`)
    }

    if (includeLabel && localLabel) {
      queryParts.push(`label=${encodeURIComponent(localLabel)}`)
    }

    let baseUri = localAddressQR

    // Remove bitcoin: prefix if not wanted (case-insensitive)
    if (!includeBitcoinPrefix && baseUri.toLowerCase().startsWith('bitcoin:')) {
      baseUri = baseUri.substring(8) // Remove "BITCOIN:" (8 characters)
    }

    return queryParts.length > 0
      ? `${baseUri}?${queryParts.join('&')}`
      : baseUri
  }, [
    amountSatsForPayjoin,
    includeBitcoinPrefix,
    includeLabel,
    includePayjoin,
    localAddress,
    localAddressQR,
    localLabel,
    payjoinEnabled,
    payjoinSession?.address,
    payjoinSession?.status,
    payjoinSession?.uri,
    payjoinUri
  ])

  const { addressInfo } = useGetFirstUnusedAddress(wallet!, account!)

  // Load address when addressInfo changes
  useEffect(() => {
    if (!wallet || !addressInfo || isManualAddress) {
      if (!wallet) {
        toast(t('error.notFound.wallet'))
        setIsLoading(false)
      } else if (addressInfo === null) {
        setIsLoading(true)
      }
      return
    }

    function loadAddress() {
      if (!addressInfo?.address) {
        return
      }

      const { address } = addressInfo
      const qrUri = `bitcoin:${address}`

      setAddressData({
        localAddress: address,
        localAddressNumber: addressInfo.index,
        localAddressPath: `${account?.keys[0].derivationPath}/0/${addressInfo.index}`,
        localAddressQR: qrUri
      })

      // Set existing label if found
      const existingAddress = account?.addresses.find(
        (addr) => addr.address === address
      )
      if (existingAddress?.label) {
        setLocalLabel(existingAddress.label)
      }

      setIsManualAddress(true)
      setIsLoading(false)
    }

    loadAddress()
  }, [addressInfo, wallet, account?.keys, account?.addresses, isManualAddress])

  function generateAnotherAddress() {
    if (!wallet || !account) {
      return
    }

    setIsGenerating(true)
    try {
      const nextIndex = (localAddressNumber || 0) + 1
      const newAddressInfo = wallet.peekAddress(
        KeychainKind.External,
        nextIndex
      )
      const address = newAddressInfo?.address ?? ''
      const qrUri = address ? `bitcoin:${address}` : ''

      setAddressData({
        localAddress: address,
        localAddressNumber: nextIndex,
        localAddressPath: `${account.keys[0].derivationPath}/0/${nextIndex}`,
        localAddressQR: qrUri
      })

      const existingAddress = account.addresses.find(
        (addr) => addr.address === address
      )
      if (existingAddress?.label) {
        setLocalLabel(existingAddress.label)
      } else {
        setLocalLabel('')
      }

      setIsManualAddress(true)
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('receive.error.generateAddress')
      toast.error(errorMessage)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleLabelChange = useCallback(
    (text: string) => {
      setLocalLabel(text)

      if (saveLabelTimeoutRef.current) {
        clearTimeout(saveLabelTimeoutRef.current)
      }

      saveLabelTimeoutRef.current = setTimeout(() => {
        if (localAddress && text.trim()) {
          const updatedAccount = setAddrLabel(id!, localAddress, text.trim())
          if (updatedAccount?.nostr?.autoSync) {
            const singleLabelData: Label = {
              label: text.trim(),
              ref: localAddress,
              spendable: true,
              type: 'addr'
            }
            sendLabelsToNostr(updatedAccount, singleLabelData)
          }
        }
      }, 1000)
    },
    [localAddress, id, setAddrLabel, sendLabelsToNostr]
  )

  async function handleNFCExport() {
    if (!localFinalAddressQR) {
      return
    }

    try {
      await emitNFCTag(localFinalAddressQR)
      toast.success(t('receive.success.exportNFC'))
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown'
      toast.error(`${t('receive.error.exportNFC')}: ${reason}`)
    }
  }

  async function copyToClipboard(text: string) {
    await Clipboard.setStringAsync(text)
    toast.success(t('common.copiedToClipboard'))
  }

  function getFiatAmount(sats: string): string {
    if (!sats || isNaN(Number(sats)) || Number(sats) <= 0) {
      return ''
    }
    const fiatAmount = satsToFiat(Number(sats))
    return fiatAmount > 0 ? `≈ ${fiatAmount.toFixed(2)} ${fiatCurrency}` : ''
  }

  function getSatsFromFiat(fiat: string): number | null {
    if (!fiat || isNaN(Number(fiat)) || Number(fiat) <= 0) {
      return null
    }
    if (!btcPrice || btcPrice <= 0) {
      return null
    }
    return Math.round((Number(fiat) / btcPrice) * 1e8)
  }

  function getSatsDisplay(fiat: string): string {
    const sats = getSatsFromFiat(fiat)
    if (sats === null) {
      return ''
    }
    return `≈ ${sats.toLocaleString()} ${t('bitcoin.sats')}`
  }

  function handleSwitchToFiat() {
    if (!btcPrice || btcPrice <= 0) {
      return
    }
    if (localCustomAmount && Number(localCustomAmount) > 0) {
      const fiat = satsToFiat(Number(localCustomAmount))
      setLocalFiatAmount(fiat > 0 ? fiat.toFixed(2) : '')
    }
    setAmountMode('fiat')
  }

  function handleSwitchToSats() {
    if (localFiatAmount) {
      const sats = getSatsFromFiat(localFiatAmount)
      if (sats !== null) {
        setLocalCustomAmount(sats.toString())
      }
    }
    setAmountMode('sats')
  }

  function handleFiatAmountChange(text: string) {
    // Allow digits and a single decimal point
    const cleaned = text
      .replace(/[^0-9.]/g, '')
      .replace(/^(\d*\.?\d*).*$/, '$1')
    setLocalFiatAmount(cleaned)
    const sats = getSatsFromFiat(cleaned)
    setLocalCustomAmount(sats !== null ? sats.toString() : undefined)
  }

  function handleToggleLabel() {
    setIncludeLabel(!includeLabel)
  }

  function handleToggleBitcoinPrefix() {
    setIncludeBitcoinPrefix(!includeBitcoinPrefix)
  }

  async function handlePasteAmount() {
    const text = await Clipboard.getStringAsync()
    if (text && !isNaN(Number(text))) {
      setLocalCustomAmount(text)
    }
  }

  async function handlePasteLabel() {
    const text = await Clipboard.getStringAsync()
    if (text) {
      setLocalLabel(text)
      handleLabelChange(text)
    }
  }

  if (!account) {
    return <Redirect href="/" />
  }

  return (
    <SSMainLayout style={{ paddingTop: 0 }}>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle() {
            return <SSText uppercase>{account.name}</SSText>
          }
        }}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <SSVStack itemsCenter gap="lg">
          <SSVStack>
            <SSVStack gap="none" itemsCenter>
              <SSText color="muted" uppercase>
                {t('receive.address')}
              </SSText>
              {isLoading ? (
                <SSText size="3xl" color="muted">
                  ...
                </SSText>
              ) : (
                <SSText size="4xl">{localAddressNumber}</SSText>
              )}
            </SSVStack>
            <SSVStack gap="none" itemsCenter>
              <SSHStack gap="sm">
                <SSText color="muted" uppercase>
                  {t('receive.path')}
                </SSText>
                {isLoading ? (
                  <SSText color="muted">...</SSText>
                ) : (
                  <SSText>{localAddressPath}</SSText>
                )}
              </SSHStack>
              <SSText>{t('receive.neverUsed')}</SSText>
            </SSVStack>
            {payjoinCompleted ? (
              <SSVStack itemsCenter gap="md" style={styles.sectionSpacing}>
                <SSSuccessCheckAnimation width={160} />
                <SSText
                  testID="receive-payjoin-completed"
                  size="md"
                  uppercase
                  weight="light"
                  center
                >
                  {t('receive.payjoin.completed.title')}
                </SSText>
                <SSText color="muted" size="sm" center>
                  {t('receive.payjoin.completed.hint')}
                </SSText>
              </SSVStack>
            ) : isLoading ? (
              <SSVStack itemsCenter gap="md">
                <SSHStack gap="xs">
                  <SSText color="muted">
                    {t('receive.findingFreshAddress')}
                  </SSText>
                  <SSEllipsisAnimation size={4} />
                </SSHStack>
              </SSVStack>
            ) : (
              localFinalAddressQR && (
                <SSVStack itemsCenter gap="md">
                  <SSQRCode
                    // BIP77 pj= URIs are long — H ecl overflows and yields no QR.
                    ecl={
                      localFinalAddressQR.toLowerCase().includes('pj=')
                        ? 'L'
                        : 'H'
                    }
                    value={localFinalAddressQR}
                  />
                  <SSHStack>
                    {nfcHardwareSupported && (
                      <SSButton
                        label={
                          isEmitting
                            ? t('receive.stopNFC')
                            : t('receive.exportViaNFC')
                        }
                        variant="outline"
                        disabled={!localFinalAddressQR}
                        onPress={isEmitting ? cancelNFCScan : handleNFCExport}
                      />
                    )}
                  </SSHStack>
                </SSVStack>
              )
            )}
            {!payjoinCompleted && localFinalAddressQR ? (
              <SSVStack gap="sm" itemsCenter style={styles.sectionSpacing}>
                <SSText>Bitcoin URI</SSText>
                <TextInput
                  testID="receive-bitcoin-uri"
                  value={localFinalAddressQR}
                  editable={false}
                  selectTextOnFocus
                  showSoftInputOnFocus={false}
                  multiline
                  style={styles.uriTextInput}
                />
                <SSButton
                  testID="receive-copy-uri"
                  label={t('common.copy')}
                  variant="secondary"
                  style={styles.copyButton}
                  onPress={() => copyToClipboard(localFinalAddressQR)}
                />
                <SSHStack gap="sm" style={styles.uriActionsRow}>
                  <SSButton
                    label={
                      includeBitcoinPrefix
                        ? t('receive.bitcoinPrefix')
                        : t('receive.noPrefix')
                    }
                    variant="outline"
                    style={styles.toggleButton}
                    onPress={handleToggleBitcoinPrefix}
                  />
                  <SSButton
                    label={
                      includeLabel
                        ? t('receive.excludeLabel')
                        : t('receive.includeLabel')
                    }
                    variant="outline"
                    style={styles.toggleButton}
                    onPress={handleToggleLabel}
                  />
                  {account?.policyType === 'singlesig' ? (
                    <SSButton
                      testID="receive-payjoin-toggle"
                      label={
                        includePayjoin && payjoinEnabled
                          ? t('receive.payjoin.disable')
                          : t('receive.payjoin.enable')
                      }
                      variant="outline"
                      style={styles.toggleButton}
                      onPress={() => {
                        // Keep pressable when empty so we can toast — `disabled`
                        // swallows taps and feels like a dead control.
                        if (!canContribute) {
                          toast.warning(t('receive.payjoin.emptyWallet'))
                          return
                        }
                        const next = !(includePayjoin && payjoinEnabled)
                        userSetPayjoinRef.current = true
                        setIncludePayjoin(next)
                        setPayjoinEnabled(next)
                      }}
                    />
                  ) : null}
                </SSHStack>
                {account?.policyType === 'singlesig' ? (
                  !canContribute ? (
                    <SSText
                      testID="receive-payjoin-empty-wallet"
                      color="muted"
                      size="sm"
                      center
                    >
                      {t('receive.payjoin.emptyWallet')}
                    </SSText>
                  ) : includePayjoin && payjoinEnabled && statusLabelKey ? (
                    <SSVStack gap="xxs" itemsCenter widthFull>
                      <SSHStack
                        gap="sm"
                        style={{ alignItems: 'center', justifyContent: 'center' }}
                      >
                        {payjoinNegotiating ||
                        statusLabelKey ===
                          'receive.payjoin.status.negotiating' ||
                        statusLabelKey === 'receive.payjoin.status.waiting' ||
                        statusLabelKey ===
                          'receive.payjoin.status.initializing' ||
                        statusLabelKey ===
                          'receive.payjoin.status.polling' ? (
                          <SSLoader size={18} />
                        ) : null}
                        <SSText
                          testID="receive-payjoin-status"
                          color="muted"
                          size="sm"
                          center
                        >
                          {payjoinNegotiating
                            ? t('receive.payjoin.status.negotiating')
                            : t(statusLabelKey)}
                        </SSText>
                      </SSHStack>
                      {payjoinExpiringLabel ? (
                        <SSText
                          testID="receive-payjoin-expiring"
                          color="muted"
                          size="xs"
                          center
                        >
                          {payjoinExpiringLabel}
                        </SSText>
                      ) : null}
                      {payjoinSession?.pjEndpoint ? (
                        <SSText
                          testID="receive-payjoin-poll-url"
                          color="muted"
                          size="xs"
                          center
                        >
                          {payjoinSession.pjEndpoint.split('#')[0]}
                        </SSText>
                      ) : null}
                    </SSVStack>
                  ) : null
                ) : null}
              </SSVStack>
            ) : null}
          </SSVStack>
          {payjoinCompleted ? null : (
            <>
              <SSFormLayout>
                <SSFormLayout.Item>
                  <SSFormLayout.Label
                    label={`${t('receive.customAmount')} (${
                      amountMode === 'sats' ? t('bitcoin.sats') : fiatCurrency
                    })`}
                  />
                  {amountMode === 'sats' ? (
                    <>
                      <SSNumberInput
                        min={DUST_LIMIT}
                        max={2_100_000_000_000_000}
                        value={localCustomAmount}
                        placeholder={t('receive.placeholder.sats')}
                        align="center"
                        keyboardType="numeric"
                        onChangeText={setLocalCustomAmount}
                        allowDecimal={false}
                        allowValidEmpty
                        alwaysTriggerOnChange
                        style={styles.amountTextInput}
                      />
                      {btcPrice > 0 && (
                        <SSText
                          color="muted"
                          size="sm"
                          center
                          onPress={handleSwitchToFiat}
                          style={styles.switchableAmount}
                        >
                          {localCustomAmount && getFiatAmount(localCustomAmount)
                            ? getFiatAmount(localCustomAmount)
                            : `${t('receive.enterIn')} ${fiatCurrency}`}
                        </SSText>
                      )}
                    </>
                  ) : (
                    <>
                      <TextInput
                        value={localFiatAmount}
                        onChangeText={handleFiatAmountChange}
                        keyboardType="decimal-pad"
                        placeholder={`0.00 ${fiatCurrency}`}
                        placeholderTextColor={Colors.gray[400]}
                        style={[styles.amountTextInput, styles.fiatTextInput]}
                      />
                      <SSText
                        color="muted"
                        size="sm"
                        center
                        onPress={handleSwitchToSats}
                        style={styles.switchableAmount}
                      >
                        {localFiatAmount && getSatsDisplay(localFiatAmount)
                          ? getSatsDisplay(localFiatAmount)
                          : `${t('receive.enterIn')} ${t('bitcoin.sats')}`}
                      </SSText>
                    </>
                  )}
                  <SSButton
                    label={t('receive.pasteAmount')}
                    variant="subtle"
                    onPress={handlePasteAmount}
                  />
                </SSFormLayout.Item>
                <SSFormLayout.Item>
                  <SSFormLayout.Label label={t('receive.label')} />
                  <SSTextInput
                    onChangeText={handleLabelChange}
                    value={localLabel}
                    placeholder={t('receive.placeholder.label')}
                    multiline
                    numberOfLines={3}
                    style={styles.labelTextInput}
                  />
                  <SSButton
                    label={t('receive.pasteLabel')}
                    variant="subtle"
                    onPress={handlePasteLabel}
                  />
                </SSFormLayout.Item>
              </SSFormLayout>
              <SSVStack>
                <SSVStack gap="xs" itemsCenter style={styles.sectionSpacing}>
                  <SSText>{t('receive.address')}</SSText>
                  {isLoading ? (
                    <SSText color="muted">...</SSText>
                  ) : (
                    localAddress && (
                      <SSVStack itemsCenter gap="xs">
                        <TextInput
                          value={formatAddressInGroups(localAddress)}
                          editable={false}
                          selectTextOnFocus
                          showSoftInputOnFocus={false}
                          multiline
                          style={styles.addressTextInput}
                        />
                        <SSHStack>
                          <SSButton
                            label={t('common.copy')}
                            variant="subtle"
                            onPress={() => copyToClipboard(localAddress)}
                          />
                        </SSHStack>
                      </SSVStack>
                    )
                  )}
                </SSVStack>
              </SSVStack>
            </>
          )}
          <SSVStack widthFull gap="sm">
            {payjoinCompleted ? (
              <>
                <SSButton
                  testID="receive-payjoin-back-home"
                  label={t('common.backToAccountHome')}
                  variant="secondary"
                  onPress={() => router.back()}
                />
                <SSButton
                  label={t('receive.generateAnother')}
                  variant="outline"
                  loading={isGenerating}
                  disabled={isGenerating || isLoading}
                  onPress={generateAnotherAddress}
                />
              </>
            ) : (
              <>
                <SSButton
                  label={t('receive.generateAnother')}
                  variant="secondary"
                  loading={isGenerating}
                  disabled={isGenerating || isLoading}
                  onPress={generateAnotherAddress}
                />
                <SSButton
                  label={t('common.cancel')}
                  variant="ghost"
                  onPress={() => router.back()}
                />
              </>
            )}
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  addressTextInput: {
    backgroundColor: Colors.gray[800],
    borderRadius: 4,
    color: Colors.white,
    fontFamily: 'monospace',
    fontSize: 16,
    letterSpacing: 1.5,
    lineHeight: 30,
    minWidth: 280,
    padding: 16,
    paddingBottom: 22,
    textAlign: 'left'
  },
  amountTextInput: {
    fontSize: 21
  },
  copyButton: {
    alignSelf: 'stretch',
    width: '100%'
  },
  fiatTextInput: {
    backgroundColor: Colors.gray[850],
    borderRadius: 3,
    color: Colors.white,
    height: 58,
    paddingHorizontal: 12,
    textAlign: 'center',
    width: '100%'
  },
  labelTextInput: {
    fontSize: 14,
    height: 'auto',
    letterSpacing: 0.5,
    lineHeight: 22,
    padding: 16,
    paddingBottom: 32,
    textAlign: 'left',
    textAlignVertical: 'top'
  },
  sectionSpacing: {
    marginVertical: 10
  },
  switchableAmount: {
    textDecorationLine: 'underline'
  },
  toggleButton: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8
  },
  uriActionsRow: {
    alignSelf: 'stretch',
    width: '100%'
  },
  uriTextInput: {
    backgroundColor: Colors.gray[800],
    borderRadius: 4,
    color: Colors.white,
    fontFamily: 'monospace',
    fontSize: 14,
    letterSpacing: 0.5,
    lineHeight: 18,
    minHeight: 80,
    minWidth: 280,
    padding: 8,
    paddingBottom: 32,
    textAlign: 'left'
  }
})
