import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { AppState, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { SATS_PER_BITCOIN } from '@/constants/btc'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Layout } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { bip21decode, isBip21, isBitcoinAddress } from '@/utils/bitcoin'

export default function NFCScan() {
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const router = useRouter()
  const [isScanning, setIsScanning] = useState(false)
  const [nfcSupported, setNfcSupported] = useState(false)

  const [clearTransaction, addOutput] = useTransactionBuilderStore(
    useShallow((state) => [state.clearTransaction, state.addOutput])
  )

  function handleAddress(address: string | void) {
    if (!address) return

    clearTransaction()
    if (isBitcoinAddress(address)) {
      addOutput({ amount: 1, label: 'Please update', to: address })
    } else if (isBip21(address)) {
      const decodedData = bip21decode(address)
      if (!decodedData || typeof decodedData === 'string') return
      addOutput({
        amount: (decodedData.options.amount || 0) * SATS_PER_BITCOIN || 1,
        label: decodedData.options.label || 'Please update',
        to: decodedData.address
      })
    }

    router.navigate({
      pathname: '/account/[id]/signAndSend/selectUtxoList',
      params: { id }
    })
  }

  useEffect(() => {
    // Check if NFC is supported on this device
    // Note: This would need to be implemented with actual NFC library
    setNfcSupported(true) // Placeholder - would check actual NFC support
  }, [])

  async function handleStartScan() {
    setIsScanning(true)
    // TODO: Implement actual NFC scanning logic here
    // This would involve:
    // 1. Requesting NFC permissions
    // 2. Starting NFC scan session
    // 3. Handling NFC tag detection
    // 4. Processing the scanned data

    // Placeholder implementation
    setTimeout(() => {
      setIsScanning(false)
      // Simulate finding a Bitcoin address
      const mockAddress = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
      handleAddress(mockAddress)
    }, 2000)
  }

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('camera.scanNFC')}</SSText>,
          headerBackground: () => (
            <LinearGradient
              style={{
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              colors={[Colors.gray[950], Colors.gray[800]]}
              start={{ x: 0.86, y: 1.0 }}
              end={{ x: 0.14, y: 1 }}
            />
          ),
          headerRight: undefined
        }}
      />
      <SSMainLayout
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          top: 0,
          paddingTop: 100,
          paddingBottom: Layout.mainContainer.paddingBottom
        }}
      >
        <SSVStack justifyBetween style={{ height: '100%' }}>
          <SSVStack itemsCenter>
            <SSText center style={{ maxWidth: 300, marginBottom: 20 }}>
              {nfcSupported
                ? isScanning
                  ? t('camera.scanningNFC')
                  : t('camera.nfcInstructions')
                : t('camera.nfcNotSupported')}
            </SSText>
            {isScanning && (
              <SSText
                center
                style={{
                  maxWidth: 300,
                  fontSize: 12,
                  color: Colors.gray[400],
                  marginBottom: 20
                }}
              >
                {t('camera.bringNFCClose')}
              </SSText>
            )}
          </SSVStack>
          <SSButton
            variant={isScanning ? 'secondary' : 'default'}
            label={isScanning ? t('common.cancel') : t('camera.startNFCScan')}
            disabled={!nfcSupported}
            onPress={() => {
              if (isScanning) {
                setIsScanning(false)
              } else {
                handleStartScan()
              }
            }}
          />
        </SSVStack>
      </SSMainLayout>
    </View>
  )
}
