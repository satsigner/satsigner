import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, TextInput } from 'react-native'
import { KeychainKind, Psbt } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { signTransaction } from '@/api/bdk'
import { processManualOriginalPsbt } from '@/api/payjoin'
import SSButton from '@/components/SSButton'
import SSEllipsisAnimation from '@/components/SSEllipsisAnimation'
import SSLoader from '@/components/SSLoader'
import SSNumberInput from '@/components/SSNumberInput'
import SSPsbtTransport from '@/components/SSPsbtTransport'
import SSQRCode from '@/components/SSQRCode'
import SSSuccessCheckAnimation from '@/components/SSSuccessCheckAnimation'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { DUST_LIMIT, SATS_PER_BITCOIN } from '@/constants/btc'
import {
  PAYJOIN_DEFAULT_PJOS,
  PAYJOIN_MIN_RECEIVE_SATS
} from '@/constants/payjoin'
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
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import {
  findExternalAddressIndex,
  resolveReceiveAddressSelection
} from '@/utils/externalAddress'
import { formatPayjoinExpiringLabel } from '@/utils/payjoinExpiry'
import { isPayjoinSuccess } from '@/utils/payjoinSessionStatus'
import { preparePayjoinPsbtForWalletSign } from '@/utils/payjoinSign'
import { parsePayjoinUri } from '@/utils/payjoinUri'
import { buildPayjoinWalletCallbacks } from '@/utils/payjoinWallet'
import {
  buildReceiveQrUri,
  shouldIncludePayjoinInUri
} from '@/utils/receiveQrUri'

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
  const existingPayjoinSession = id
    ? usePayjoinSessionsStore.getState().getActiveReceiverSession(id)
    : undefined

  const [addressData, setAddressData] = useState<{
    localAddress?: string
    localAddressNumber?: number
    localAddressQR?: string
    localAddressPath?: string
  }>(() => {
    const addr = existingPayjoinSession?.address
    if (!addr) {
      return {}
    }
    return {
      localAddress: addr,
      localAddressQR: `bitcoin:${addr}`
    }
  })

  const {
    localAddress,
    localAddressNumber: storedAddressNumber,
    localAddressQR,
    localAddressPath: storedAddressPath
  } = addressData
  const localAddressNumber =
    storedAddressNumber ??
    (wallet && localAddress
      ? findExternalAddressIndex(wallet, localAddress)
      : undefined)
  const localAddressPath =
    storedAddressPath ??
    (account && localAddressNumber !== undefined
      ? `${account.keys[0].derivationPath}/0/${localAddressNumber}`
      : undefined)
  const [localCustomAmount, setLocalCustomAmount] = useState<string>(() => {
    const sats = amountSatsFromPayjoinSession(existingPayjoinSession)
    return sats ? String(sats) : String(DUST_LIMIT)
  })
  const [localFiatAmount, setLocalFiatAmount] = useState<string>()
  const [amountMode, setAmountMode] = useState<'sats' | 'fiat'>('sats')
  const [localLabel, setLocalLabel] = useState<string>(
    () => labelFromPayjoinSession(existingPayjoinSession) ?? ''
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [includeLabel, setIncludeLabel] = useState(true)
  const [includeAmount] = useState(true)
  const [includeBitcoinPrefix, setIncludeBitcoinPrefix] = useState(true)
  const [includePayjoin, setIncludePayjoin] = useState(true)
  const [isLoading, setIsLoading] = useState(
    () => !existingPayjoinSession?.address
  )
  const [isManualAddress, setIsManualAddress] = useState(
    () => !!existingPayjoinSession?.address
  )
  // Distinguishes "user turned Payjoin off" from "we auto-disabled while UTXOs
  // were still empty on first paint" so we can re-enable once coins appear.
  const userSetPayjoinRef = useRef(false)

  // Master switch is read-only here; per-invoice control is local `includePayjoin`.
  const payjoinEnabled = useSettingsStore((state) => state.payjoinEnabled)
  const payjoinCoordinationMode = useSettingsStore(
    (state) => state.payjoinCoordinationMode
  )
  const isManualPayjoin = payjoinCoordinationMode === 'manual'

  const accountUtxos = account?.utxos ?? []
  const canContributePayjoin = walletCanContributeToPayjoin(
    accountUtxos,
    account?.transactions ?? []
  )
  const [manualProposalPsbt, setManualProposalPsbt] = useState<string | null>(
    null
  )
  const [manualBusy, setManualBusy] = useState(false)

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

  const saveLabelTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  function formatAddressInGroups(address: string): string {
    return (address.match(/(.{1,4})/g) || []).join(' ')
  }

  const amountSatsForPayjoin =
    includeAmount &&
    localCustomAmount &&
    Number(localCustomAmount) > 0 &&
    Number(localCustomAmount) <= 2_100_000_000_000_000
      ? Number(localCustomAmount)
      : undefined

  function signPayjoinPsbt(psbtBase64: string) {
    if (!wallet) {
      return psbtBase64
    }
    const prepared = preparePayjoinPsbtForWalletSign({
      getPrevTxHex: (txid) => wallet.getTx(txid),
      psbtBase64,
      utxos: account?.utxos ?? []
    })
    const proposal = new Psbt(prepared)
    signTransaction(proposal, wallet)
    return proposal.toBase64()
  }

  const {
    canContribute,
    payjoinUri,
    session: payjoinSession,
    statusLabelKey,
    negotiating: payjoinNegotiating
  } = usePayjoinReceiver({
    account,
    accountId: id!,
    address:
      !isManualPayjoin &&
      includePayjoin &&
      payjoinEnabled &&
      canContributePayjoin
        ? localAddress
        : undefined,
    amountSats: amountSatsForPayjoin,
    label: includeLabel ? localLabel : undefined,
    signPsbt: signPayjoinPsbt,
    utxos: accountUtxos
  })

  async function handleImportManualOriginal(originalPsbtBase64: string) {
    if (!account || !localAddress || !wallet) {
      toast.error(t('receive.payjoin.manual.missingAddress'))
      return
    }
    setManualBusy(true)
    try {
      const store = usePayjoinSessionsStore.getState()
      const callbacks = buildPayjoinWalletCallbacks({
        hasSeenInput: (outpoint) => store.hasSeenInput(outpoint),
        markInputSeen: (outpoint) => store.markInputSeen(outpoint),
        network: bitcoinjsNetwork(account.network),
        ownedAddresses: [
          localAddress,
          ...(account.addresses ?? []).map((a) => a.address)
        ],
        signPsbt: signPayjoinPsbt,
        transactions: account.transactions ?? [],
        utxos: accountUtxos
      })
      const result = await processManualOriginalPsbt({
        callbacks,
        disableOutputSubstitution: PAYJOIN_DEFAULT_PJOS === 0,
        originalPsbtBase64: originalPsbtBase64,
        ownedScriptsHex: callbacks.ownedScriptsHex,
        receiveAddress: localAddress,
        seenOutpoints: []
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setManualProposalPsbt(result.proposalPsbtBase64)
      toast.success(t('receive.payjoin.manual.proposalReady'))
    } finally {
      setManualBusy(false)
    }
  }

  const nowMs = useNow()
  const payjoinExpiringLabel = formatPayjoinExpiringLabel(
    payjoinSession?.expiresAt,
    nowMs
  )
  const payjoinCompleted =
    !!payjoinSession && isPayjoinSuccess(payjoinSession.status)
  const advertisePayjoinInQr = shouldIncludePayjoinInUri({
    amountSats: amountSatsForPayjoin
  })
  const showBelowMinReceiveHint =
    includePayjoin &&
    payjoinEnabled &&
    !isManualPayjoin &&
    canContribute &&
    amountSatsForPayjoin !== undefined &&
    !advertisePayjoinInQr
  const celebratedPayjoinIdRef = useRef<string | null>(null)

  // Auto-toggle payjoin when contribution eligibility changes (not during render —
  // siblings like TotalTransactions stay mounted under the account stack).
  useEffect(() => {
    if (!canContribute && includePayjoin) {
      setIncludePayjoin(false)
      return
    }
    if (
      canContribute &&
      !userSetPayjoinRef.current &&
      payjoinEnabled &&
      !includePayjoin
    ) {
      setIncludePayjoin(true)
    }
  }, [canContribute, includePayjoin, payjoinEnabled])

  // Hydrate amount/label once when a resumed session appears.
  const hydratedSessionIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!payjoinSession?.id) {
      return
    }
    if (hydratedSessionIdRef.current === payjoinSession.id) {
      return
    }
    hydratedSessionIdRef.current = payjoinSession.id
    const sats = amountSatsFromPayjoinSession(payjoinSession)
    if (sats && (!localCustomAmount || Number(localCustomAmount) <= 0)) {
      setLocalCustomAmount(String(sats))
    }
    const sessionLabel = labelFromPayjoinSession(payjoinSession)
    if (sessionLabel && !localLabel) {
      setLocalLabel(sessionLabel)
    }
  }, [localCustomAmount, localLabel, payjoinSession])

  const localFinalAddressQR = buildReceiveQrUri({
    amountSats: amountSatsForPayjoin,
    includeBitcoinPrefix,
    includeLabel,
    includePayjoin,
    label: localLabel,
    localAddress,
    localAddressQR,
    payjoinEnabled,
    payjoinSessionAddress: payjoinSession?.address,
    payjoinSessionStatus: payjoinSession?.status,
    payjoinSessionUri: payjoinSession?.uri,
    payjoinUri
  })

  const { addressInfo } = useGetFirstUnusedAddress(wallet!, account!)

  // Load / pin receive address after first-unused (or active session) resolves.
  useEffect(() => {
    if (!wallet && isLoading) {
      setIsLoading(false)
      return
    }
    if (isManualAddress) {
      return
    }
    if (addressInfo === null) {
      if (!isLoading) {
        setIsLoading(true)
      }
      return
    }
    if (!wallet || !account || !addressInfo.address) {
      return
    }
    const derivationPath = account.keys[0]?.derivationPath
    if (!derivationPath) {
      return
    }
    const activeSession = id
      ? usePayjoinSessionsStore.getState().getActiveReceiverSession(id)
      : undefined
    const selection = resolveReceiveAddressSelection({
      derivationPath,
      fallback: {
        address: addressInfo.address,
        index: addressInfo.index
      },
      preferredAddress: activeSession?.address,
      wallet
    })
    setAddressData({
      localAddress: selection.address,
      localAddressNumber: selection.index,
      localAddressPath: selection.path,
      localAddressQR: selection.qrUri
    })
    const existingAddress = account.addresses.find(
      (addr) => addr.address === selection.address
    )
    if (existingAddress?.label) {
      setLocalLabel(existingAddress.label)
    }
    setIsManualAddress(true)
    setIsLoading(false)
  }, [account, addressInfo, id, isLoading, isManualAddress, wallet])

  // Completion toast/haptics are external side effects — keep a narrow effect.
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

  function handleLabelChange(text: string) {
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
  }

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
    setLocalCustomAmount(sats !== null ? sats.toString() : '')
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
                        const next = !includePayjoin
                        userSetPayjoinRef.current = true
                        setIncludePayjoin(next)
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
                  ) : (
                    <SSVStack gap="xxs" itemsCenter widthFull>
                      {showBelowMinReceiveHint ? (
                        <SSText
                          testID="receive-payjoin-below-min"
                          color="muted"
                          size="sm"
                          center
                        >
                          {t('receive.payjoin.belowMinReceive', {
                            count: PAYJOIN_MIN_RECEIVE_SATS
                          })}
                        </SSText>
                      ) : null}
                      {includePayjoin &&
                      payjoinEnabled &&
                      isManualPayjoin ? (
                        <SSVStack gap="sm" itemsCenter widthFull>
                          <SSText color="muted" size="sm" center>
                            {t('receive.payjoin.manual.hint')}
                          </SSText>
                          <SSText size="sm" uppercase center>
                            {t('receive.payjoin.manual.importOriginal')}
                          </SSText>
                          <SSPsbtTransport
                            mode="import"
                            testIDPrefix="receive-payjoin-import"
                            disabled={!localAddress}
                            loading={manualBusy}
                            pasteLabel={t('common.paste')}
                            onImport={handleImportManualOriginal}
                          />
                          {manualProposalPsbt ? (
                            <SSVStack gap="sm" itemsCenter widthFull>
                              <SSText size="sm" uppercase center>
                                {t('receive.payjoin.manual.copyProposal')}
                              </SSText>
                              <SSPsbtTransport
                                mode="export"
                                testIDPrefix="receive-payjoin-export"
                                psbtBase64={manualProposalPsbt}
                                disabled={manualBusy}
                                copyLabel={t('common.copy')}
                              />
                            </SSVStack>
                          ) : null}
                        </SSVStack>
                      ) : null}
                      {includePayjoin &&
                      payjoinEnabled &&
                      !isManualPayjoin &&
                      statusLabelKey ? (
                        <SSVStack gap="xxs" itemsCenter widthFull>
                          <SSHStack
                            gap="sm"
                            style={{
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {payjoinNegotiating ||
                            statusLabelKey ===
                              'receive.payjoin.status.negotiating' ||
                            statusLabelKey ===
                              'receive.payjoin.status.waiting' ||
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
                      ) : null}
                    </SSVStack>
                  )
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
