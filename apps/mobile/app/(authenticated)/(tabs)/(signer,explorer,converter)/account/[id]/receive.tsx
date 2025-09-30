import * as Clipboard from 'expo-clipboard'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, TextInput } from 'react-native'
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
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

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

  const [localAddress, setLocalAddress] = useState<string>()
  const [localAddressNumber, setLocalAddressNumber] = useState<number>()
  const [localAddressQR, setLocalAddressQR] = useState<string>()
  const [localFinalAddressQR, setLocalFinalAddressQR] = useState<string>()
  const [localAddressPath, setLocalAddressPath] = useState<string>()
  const [localCustomAmount, setLocalCustomAmount] = useState<string>()
  const [localLabel, setLocalLabel] = useState<string>()
  const [isGenerating, setIsGenerating] = useState(false)
  const [includeLabel, setIncludeLabel] = useState(true)
  const [includeAmount] = useState(true)
  const [includeBitcoinPrefix, setIncludeBitcoinPrefix] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isManualAddress, setIsManualAddress] = useState(false)

  const {
    isAvailable: nfcAvailable,
    isEmitting,
    emitNFCTag,
    cancelNFCScan
  } = useNFCEmitter()

  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )

  const saveLabelTimeoutRef = useRef<NodeJS.Timeout>()

  function formatAddressInGroups(address: string): string {
    return (address.match(/(.{1,4})/g) || []).join(' ')
  }

  useEffect(() => {
    return () => {
      if (saveLabelTimeoutRef.current) {
        clearTimeout(saveLabelTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!localAddressQR) return

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

    const finalUri =
      queryParts.length > 0 ? `${baseUri}?${queryParts.join('&')}` : baseUri

    setLocalFinalAddressQR(finalUri)
  }, [
    localCustomAmount,
    localLabel,
    includeAmount,
    includeLabel,
    includeBitcoinPrefix,
    localAddressQR
  ])

  const { addressInfo } = useGetFirstUnusedAddress(wallet!, account!)

  useEffect(() => {
    async function loadAddress() {
      if (!wallet) {
        toast(t('error.notFound.wallet'))
        setIsLoading(false)
        return
      }

      if (addressInfo === null) {
        setIsLoading(true)
        return
      }

      if (isManualAddress) {
        return
      }

      const [address, qrUri] = await Promise.all([
        addressInfo?.address ? addressInfo.address.asString() : '',
        addressInfo?.address ? addressInfo.address.toQrUri() : ''
      ])
      setLocalAddress(address)
      setLocalAddressNumber(addressInfo.index)
      setLocalAddressQR(qrUri)
      setLocalFinalAddressQR(qrUri)
      setLocalAddressPath(
        `${account?.keys[0].derivationPath}/0/${addressInfo.index}`
      )

      const existingAddress = account?.addresses.find((addr) => {
        return addr.address === address
      })
      if (existingAddress?.label) {
        setLocalLabel(existingAddress.label)
      }

      setIsManualAddress(true)
      setIsLoading(false)
    }

    loadAddress()
  }, [addressInfo, isManualAddress, account?.addresses, account?.keys, wallet])

  async function generateAnotherAddress() {
    if (!wallet || !account) return

    setIsGenerating(true)
    try {
      const nextIndex = (localAddressNumber || 0) + 1
      const newAddressInfo = await wallet.getAddress(nextIndex)
      const [address, qrUri] = await Promise.all([
        newAddressInfo?.address ? newAddressInfo.address.asString() : '',
        newAddressInfo?.address ? newAddressInfo.address.toQrUri() : ''
      ])

      setLocalAddress(address)
      setLocalAddressNumber(nextIndex)
      setLocalAddressQR(qrUri)
      setLocalFinalAddressQR(qrUri)
      setLocalAddressPath(`${account.keys[0].derivationPath}/0/${nextIndex}`)

      const existingAddress = account.addresses.find((addr) => {
        return addr.address === address
      })
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
          setAddrLabel(id!, localAddress, text.trim())
        }
      }, 1000)
    },
    [localAddress, id, setAddrLabel]
  )

  async function handleNFCExport() {
    if (!localFinalAddressQR) return

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
    if (!sats || isNaN(Number(sats)) || Number(sats) <= 0) return ''
    const fiatAmount = satsToFiat(Number(sats))
    return fiatAmount > 0 ? `≈ ${fiatAmount.toFixed(2)} ${fiatCurrency}` : ''
  }

  const handleToggleLabel = () => {
    setIncludeLabel(!includeLabel)
  }

  const handleToggleBitcoinPrefix = () => {
    setIncludeBitcoinPrefix(!includeBitcoinPrefix)
  }

  const handlePasteAmount = async () => {
    const text = await Clipboard.getStringAsync()
    if (text && !isNaN(Number(text))) {
      setLocalCustomAmount(text)
    }
  }

  const handlePasteLabel = async () => {
    const text = await Clipboard.getStringAsync()
    if (text) {
      setLocalLabel(text)
      handleLabelChange(text)
    }
  }

  if (!account) return <Redirect href="/" />

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle() {
            return <SSText uppercase>{account.name}</SSText>
          },
          headerRight: undefined
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
                <SSVStack itemsCenter gap="lg">
                  <SSQRCode value={localFinalAddressQR} />
                  <SSHStack>
                    {nfcAvailable && (
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
                    variant={includeBitcoinPrefix ? 'default' : 'outline'}
                    style={styles.toggleButton}
                    onPress={handleToggleBitcoinPrefix}
                  />
                  <SSButton
                    label={
                      includeLabel
                        ? t('receive.excludeLabel')
                        : t('receive.includeLabel')
                    }
                    variant={includeLabel ? 'default' : 'outline'}
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
                label={
                  t('receive.customAmount') + ' (' + t('bitcoin.sats') + ')'
                }
              />
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
              {localCustomAmount && getFiatAmount(localCustomAmount) && (
                <SSText color="muted" size="sm" center>
                  {getFiatAmount(localCustomAmount)}
                </SSText>
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
  uriTextInput: {
    fontFamily: 'monospace',
    color: Colors.white,
    padding: 8,
    backgroundColor: Colors.gray[800],
    borderRadius: 4,
    minWidth: 280,
    minHeight: 80,
    fontSize: 14,
    textAlign: 'left',
    paddingBottom: 32,
    lineHeight: 18,
    letterSpacing: 0.5
  },
  addressTextInput: {
    fontFamily: 'monospace',
    color: Colors.white,
    padding: 16,
    paddingBottom: 22,
    backgroundColor: Colors.gray[800],
    borderRadius: 4,
    minWidth: 280,
    fontSize: 16,
    lineHeight: 30,
    letterSpacing: 1.5,
    textAlign: 'left'
  },
  labelTextInput: {
    height: 'auto',
    textAlignVertical: 'top',
    padding: 16,
    paddingBottom: 32,
    fontSize: 14,
    lineHeight: 22,
    letterSpacing: 0.5,
    textAlign: 'left'
  },
  amountTextInput: {
    fontSize: 21
  },
  sectionSpacing: {
    marginVertical: 10
  },
  toggleButton: {
    flex: 1
  }
})
