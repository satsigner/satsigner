import { CameraView, useCameraPermissions } from 'expo-camera/next'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconBlackIndicator,
  SSIconCamera,
  SSIconECash,
  SSIconGreenIndicator
} from '@/components/icons'
import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSEcashTransactionCard from '@/components/SSEcashTransactionCard'
import SSIconButton from '@/components/SSIconButton'
import SSModal from '@/components/SSModal'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { useEcashStore } from '@/store/ecash'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { formatFiatPrice } from '@/utils/format'
import { getLNURLType } from '@/utils/lnurl'

export default function EcashLanding() {
  const router = useRouter()
  const {
    mints,
    activeMint,
    proofs,
    transactions,
    checkPendingTransactionStatus,
    setActiveMint
  } = useEcash()
  const ecashStatus = useEcashStore((state) => state.status)
  const useZeroPadding = useSettingsStore((state) => state.useZeroPadding)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()
  const [fiatCurrency, btcPrice, fetchPrices] = usePriceStore(
    useShallow((state) => [
      state.fiatCurrency,
      state.btcPrice,
      state.fetchPrices
    ])
  )
  const mempoolUrl = useBlockchainStore(
    (state) => state.configsMempool['bitcoin']
  )

  useEffect(() => {
    if (activeMint && mints.length > 0) {
      const mintFromArray = mints.find((m) => m.url === activeMint.url)
      if (mintFromArray && mintFromArray !== activeMint) {
        setActiveMint(mintFromArray)
      }
    } else if (!activeMint && mints.length > 0) {
      setActiveMint(mints[0])
    }
  }, [mints, activeMint, setActiveMint])

  useEffect(() => {
    fetchPrices(mempoolUrl)
  }, [fetchPrices, fiatCurrency, mempoolUrl])

  const lastCheckTimeRef = useRef<number>(0)
  const CHECK_COOLDOWN = 5000

  useEffect(() => {
    const now = Date.now()
    if (now - lastCheckTimeRef.current >= CHECK_COOLDOWN) {
      lastCheckTimeRef.current = now
      checkPendingTransactionStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFocusEffect(
    useCallback(() => {
      const now = Date.now()
      if (now - lastCheckTimeRef.current >= CHECK_COOLDOWN) {
        lastCheckTimeRef.current = now
        checkPendingTransactionStatus()
      }
    }, [checkPendingTransactionStatus])
  )

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      if (now - lastCheckTimeRef.current >= CHECK_COOLDOWN) {
        lastCheckTimeRef.current = now
        checkPendingTransactionStatus()
      }
    }, 30000)

    return () => {
      clearInterval(interval)
    }
  }, [checkPendingTransactionStatus])

  const handleReceivePress = () => router.navigate('/signer/ecash/receive')
  const handleCameraPress = () => setCameraModalVisible(true)
  const handleSettingsPress = () => router.navigate('/signer/ecash/settings')
  const handleAddMintPress = () =>
    router.navigate('/signer/ecash/settings/mint')

  function getConnectionErrorMessage(error?: string): string {
    if (!error) {
      return t('ecash.error.mintNotConnected')
    }

    const errorLower = error.toLowerCase()

    if (
      errorLower.includes('429') ||
      errorLower.includes('rate limit') ||
      errorLower.includes('too many requests') ||
      errorLower.includes('rate limited')
    ) {
      return t('ecash.error.mintRateLimited')
    }

    if (
      errorLower.includes('403') ||
      errorLower.includes('forbidden') ||
      errorLower.includes('blocked') ||
      errorLower.includes('access denied')
    ) {
      return t('ecash.error.mintBlocked')
    }

    return error || t('ecash.error.mintNotConnected')
  }

  function handleQRCodeScanned({ data }: { data: string }) {
    setCameraModalVisible(false)

    const cleanData = data.trim()

    if (cleanData.startsWith('lightning:') || cleanData.startsWith('lnbc')) {
      router.navigate({
        pathname: '/signer/ecash/send',
        params: { invoice: cleanData.replace(/^lightning:/i, '') }
      })
      toast.success(t('ecash.scan.lightningInvoiceScanned'))
      return
    }

    const { isLNURL: isLNURLInput, type: lnurlType } = getLNURLType(cleanData)
    if (isLNURLInput) {
      if (lnurlType === 'pay') {
        router.navigate({
          pathname: '/signer/ecash/send',
          params: { invoice: cleanData }
        })
        toast.success(t('ecash.scan.lnurlPayScanned'))
        return
      } else if (lnurlType === 'withdraw') {
        router.navigate({
          pathname: '/signer/ecash/receive',
          params: { lnurl: cleanData }
        })
        toast.success(t('ecash.scan.lnurlWithdrawScanned'))
        return
      } else {
        router.navigate({
          pathname: '/signer/ecash/send',
          params: { invoice: cleanData }
        })
        toast.success(t('ecash.scan.lnurlScanned'))
        return
      }
    }

    if (cleanData.startsWith('cashu://') || cleanData.startsWith('cashu')) {
      router.navigate({
        pathname: '/signer/ecash/receive',
        params: { token: cleanData }
      })
      toast.success(t('ecash.scan.tokenScanned'))
      return
    }

    toast.success(t('ecash.scan.unknownQRCode'))
  }

  const totalBalance = proofs.reduce((sum, proof) => sum + proof.amount, 0)

  return (
    <SSMainLayout style={{ paddingTop: 0 }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('navigation.item.ecash')}</SSText>
          ),
          headerRight: () => (
            <SSIconButton onPress={handleSettingsPress}>
              <SSIconECash height={18} width={16} />
            </SSIconButton>
          )
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack style={{ paddingBottom: 60 }}>
          <SSVStack style={styles.balanceContainer} gap="xs">
            <SSText color="muted" size="xs" uppercase>
              {t('ecash.mint.balance')}
            </SSText>
            <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
              <SSStyledSatText
                amount={totalBalance}
                decimals={0}
                useZeroPadding={useZeroPadding}
                textSize={totalBalance > 1_000_000_000 ? '4xl' : '6xl'}
                weight="ultralight"
                letterSpacing={-1}
              />
              <SSText size="xl" color="muted">
                {t('bitcoin.sats').toLowerCase()}
              </SSText>
            </SSHStack>
            {btcPrice > 0 && (
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText color="muted">
                  {formatFiatPrice(totalBalance, btcPrice)}
                </SSText>
                <SSText size="xs" style={{ color: Colors.gray[500] }}>
                  {fiatCurrency}
                </SSText>
              </SSHStack>
            )}
            {mints.length > 0 && (
              <SSVStack style={styles.statusContainer} gap="xs">
                {activeMint && (
                  <>
                    <SSHStack gap="xs" style={{ alignItems: 'center' }}>
                      {activeMint.isConnected ? (
                        <SSIconGreenIndicator height={12} width={12} />
                      ) : (
                        <SSIconBlackIndicator height={12} width={12} />
                      )}
                      <SSText color="muted" size="sm">
                        {activeMint.name || activeMint.url}
                      </SSText>
                    </SSHStack>
                    {!activeMint.isConnected && (
                      <SSText
                        size="xs"
                        style={[styles.errorText, { color: Colors.error }]}
                      >
                        {getConnectionErrorMessage(ecashStatus.lastError)}
                      </SSText>
                    )}
                  </>
                )}
              </SSVStack>
            )}
          </SSVStack>
          <SSHStack justifyEvenly gap="none">
            <SSActionButton
              onPress={() => router.navigate('/signer/ecash/send')}
              style={{
                ...styles.actionButton,
                width: '40%'
              }}
            >
              <SSText uppercase>{t('ecash.send.title')}</SSText>
            </SSActionButton>
            <SSActionButton
              onPress={handleCameraPress}
              style={{
                ...styles.actionButton,
                width: '18%'
              }}
            >
              <SSIconCamera height={13} width={18} />
            </SSActionButton>
            <SSActionButton
              onPress={handleReceivePress}
              style={{
                ...styles.actionButton,
                width: '40%'
              }}
            >
              <SSText uppercase>{t('ecash.receive.title')}</SSText>
            </SSActionButton>
          </SSHStack>
          {!activeMint && (
            <SSVStack style={styles.noMintContainer} gap="md">
              <SSVStack gap="xs" style={styles.noMintMessage}>
                <SSText color="muted" center>
                  {t('ecash.mint.noMintSelected')}
                </SSText>
                <SSText color="muted" size="sm" center>
                  {t('ecash.mint.noMintSelectedDescription')}
                </SSText>
              </SSVStack>
              <SSButton
                label={t('ecash.mint.addMint')}
                onPress={handleAddMintPress}
                variant="gradient"
                gradientType="special"
                style={styles.addMintButton}
              />
            </SSVStack>
          )}
          {activeMint && transactions.length === 0 && (
            <SSVStack style={styles.noTransactionsContainer} gap="xs">
              <SSText color="muted" center size="sm">
                {t('ecash.noTransactions')}
              </SSText>
            </SSVStack>
          )}
          {transactions.length > 0 && (
            <SSVStack gap="sm">
              {transactions.slice(0, 50).map((transaction) => (
                <SSEcashTransactionCard
                  key={transaction.id}
                  transaction={transaction}
                />
              ))}
              {transactions.length > 50 && (
                <SSText color="muted" size="sm" style={styles.moreTransactions}>
                  {t('ecash.moreTransactions', {
                    count: transactions.length - 50
                  })}
                </SSText>
              )}
            </SSVStack>
          )}
        </SSVStack>
      </ScrollView>
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
  actionButton: {
    backgroundColor: Colors.gray[925],
    marginLeft: 2,
    borderTopWidth: 1,
    borderTopColor: '#242424',
    borderRadius: 3
  },
  balanceContainer: {
    alignItems: 'center',
    paddingTop: 40
  },
  camera: {
    flex: 1,
    width: 340,
    height: 340
  },
  headerContainer: {},
  headerText: {
    color: Colors.white
  },
  statusContainer: {
    paddingBottom: 20,
    alignItems: 'center'
  },
  moreTransactions: {
    textAlign: 'center',
    paddingVertical: 8
  },
  noMintContainer: {
    paddingTop: 20,
    paddingBottom: 10
  },
  noMintMessage: {
    alignItems: 'center'
  },
  addMintButton: {
    marginTop: 8
  },
  noTransactionsContainer: {
    paddingTop: 20,
    paddingBottom: 10,
    alignItems: 'center'
  },
  errorText: {
    paddingTop: 4,
    textAlign: 'center'
  }
})
