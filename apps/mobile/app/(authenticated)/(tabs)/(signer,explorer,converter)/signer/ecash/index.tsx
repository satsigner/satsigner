import { CameraView, useCameraPermissions } from 'expo-camera/next'
import { Stack, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconCamera, SSIconECash } from '@/components/icons'
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
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { formatFiatPrice } from '@/utils/format'
import { isLNURL } from '@/utils/lnurl'

export default function EcashLanding() {
  const router = useRouter()
  const { mints, activeMint, proofs, transactions } = useEcash()
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

  // Fetch prices on mount and when currency changes
  useEffect(() => {
    fetchPrices(mempoolUrl)
  }, [fetchPrices, fiatCurrency, mempoolUrl])

  function handleReceivePress() {
    router.navigate('/signer/ecash/receive')
  }

  function handleCameraPress() {
    setCameraModalVisible(true)
  }

  function handleSettingsPress() {
    router.navigate('/signer/ecash/settings')
  }

  function handleQRCodeScanned({ data }: { data: string }) {
    setCameraModalVisible(false)

    // Clean the data (remove any whitespace and prefixes)
    const cleanData = data.trim()

    // Check if it's a lightning invoice
    if (cleanData.startsWith('lightning:') || cleanData.startsWith('lnbc')) {
      router.navigate({
        pathname: '/signer/ecash/send',
        params: { invoice: cleanData.replace(/^lightning:/i, '') }
      })
      toast.success(t('ecash.scan.lightningInvoiceScanned'))
      return
    }

    // Check if it's an LNURL
    if (isLNURL(cleanData)) {
      router.navigate({
        pathname: '/signer/ecash/send',
        params: { invoice: cleanData }
      })
      toast.success(t('ecash.scan.lnurlScanned'))
      return
    }

    // Check if it's an ecash token (cashu:// or starts with cashu)
    if (cleanData.startsWith('cashu://') || cleanData.startsWith('cashu')) {
      router.navigate({
        pathname: '/signer/ecash/receive',
        params: { token: cleanData }
      })
      toast.success(t('ecash.scan.tokenScanned'))
      return
    }

    toast.success(t('ecash.scan.qrCodeScanned'))
  }

  // Calculate total balance from all proofs
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
              <SSVStack style={styles.statusContainer} gap="none">
                {activeMint && (
                  <SSText color="muted" size="sm">
                    {activeMint.name || activeMint.url}
                  </SSText>
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
  }
})
