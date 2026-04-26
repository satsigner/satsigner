import * as Clipboard from 'expo-clipboard'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, TextInput } from 'react-native'
import { KeychainKind } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSEllipsisAnimation from '@/components/SSEllipsisAnimation'
import SSNumberInput from '@/components/SSNumberInput'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import useGetFirstUnusedAddress from '@/hooks/useGetFirstUnusedAddress'
import { useNFCEmitter } from '@/hooks/useNFCEmitter'
import useNostrSync from '@/hooks/useNostrSync'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { type Label } from '@/utils/bip329'

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

  const [addressData, setAddressData] = useState<{
    localAddress?: string
    localAddressNumber?: number
    localAddressQR?: string
    localAddressPath?: string
  }>({})

  const { localAddress, localAddressNumber, localAddressQR, localAddressPath } =
    addressData
  const [localCustomAmount, setLocalCustomAmount] = useState<string>()
  const [localFiatAmount, setLocalFiatAmount] = useState<string>()
  const [amountMode, setAmountMode] = useState<'sats' | 'fiat'>('sats')
  const [localLabel, setLocalLabel] = useState<string>()
  const [isGenerating, setIsGenerating] = useState(false)
  const [includeLabel, setIncludeLabel] = useState(true)
  const [includeAmount] = useState(true)
  const [includeBitcoinPrefix, setIncludeBitcoinPrefix] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isManualAddress, setIsManualAddress] = useState(false)

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

  const localFinalAddressQR = useMemo(() => {
    if (!localAddressQR) {
      return ''
    }

    const queryParts: string[] = []

    if (
      includeAmount &&
      localCustomAmount &&
      Number(localCustomAmount) > 0 &&
      Number(localCustomAmount) <= 2_100_000_000_000_000
    ) {
      const amountInBTC = Number(localCustomAmount) / 100_000_000
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
    localCustomAmount,
    localLabel,
    includeAmount,
    includeLabel,
    includeBitcoinPrefix,
    localAddressQR
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
      const errorMessage =
        error instanceof Error ? error.message : t('receive.error.exportNFC')
      toast.error(errorMessage)
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
      <ScrollView>
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
            {isLoading ? (
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
                  <SSQRCode value={localFinalAddressQR} />
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
            {localFinalAddressQR && (
              <SSVStack gap="sm" itemsCenter style={styles.sectionSpacing}>
                <SSText>Bitcoin URI</SSText>
                <TextInput
                  value={localFinalAddressQR}
                  editable={false}
                  selectTextOnFocus
                  multiline
                  style={styles.uriTextInput}
                />
                <SSHStack gap="sm" justifyBetween>
                  <SSButton
                    label={t('common.copy')}
                    variant="secondary"
                    style={styles.toggleButton}
                    onPress={() => copyToClipboard(localFinalAddressQR)}
                  />
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
                </SSHStack>
              </SSVStack>
            )}
          </SSVStack>
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
                    min={1}
                    max={2_100_000_000_000_000}
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
          <SSVStack widthFull gap="sm">
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
    flex: 1
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
