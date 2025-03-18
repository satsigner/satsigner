import { type BarCodeScanningResult } from 'expo-camera'
import { CameraView, useCameraPermissions } from 'expo-camera/next'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { AppState, StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSCameraOverlay from '@/components/SSCameraOverlay'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Layout } from '@/styles'
import { bip21decode } from '@/utils/bitcoin'
import {
  clearClipboard,
  getBitcoinAddressFromClipboard
} from '@/utils/clipboard'

export default function Camera() {
  const [permission, requestPermission] = useCameraPermissions()
  const [shouldFreezeCamera, setShouldFreezeCamera] = useState(false)

  const appState = useRef(AppState.currentState)
  const [hasToPaste, setHasToPaste] = useState(false)

  useEffect(() => {
    ;(async () => {
      const text = await getBitcoinAddressFromClipboard()
      setHasToPaste(!!text)
    })()
    const subscription = AppState.addEventListener(
      'change',
      async (nextAppState) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          setTimeout(async () => {
            const text = await getBitcoinAddressFromClipboard()
            setHasToPaste(!!text)
          }, 1) // Refactor: without timeout, getStringAsync returns false
        }
        appState.current = nextAppState
      }
    )
    return () => {
      subscription.remove()
    }
  }, [])

  async function handlePaste() {
    const clipboard = await getBitcoinAddressFromClipboard()
    if (clipboard) {
      await clearClipboard()
    }
    setHasToPaste(false)
  }

  const handleScanCode = (event: BarCodeScanningResult): void => {
    if (shouldFreezeCamera) {
      return
    }

    setShouldFreezeCamera(true)
    const _decodedData = bip21decode(event.data)
  }

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('camera.scanQRCode')}</SSText>
          ),
          headerBackground: () => (
            <LinearGradient
              style={{
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              colors={[Colors.gray[900], Colors.gray[800]]}
              start={{ x: 0.86, y: 1.0 }}
              end={{ x: 0.14, y: 1 }}
            />
          ),
          headerRight: undefined
        }}
      />
      <CameraView
        onBarcodeScanned={handleScanCode}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        style={StyleSheet.absoluteFillObject}
      />
      <SSCameraOverlay active={permission?.granted} />
      <SSMainLayout
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          top: 0,
          paddingTop: 368,
          paddingBottom: Layout.mainContainer.paddingBottom,
          backgroundColor: 'transparent'
        }}
      >
        <SSVStack justifyBetween>
          <SSVStack itemsCenter>
            {permission?.granted ? (
              <SSText center style={{ maxWidth: 250 }}>
                {t('camera.scanText')}
              </SSText>
            ) : (
              <>
                <SSText center style={{ maxWidth: 250 }}>
                  {t('camera.permissions')}
                </SSText>
                <SSButton
                  label={t('camera.enableCameraAccess')}
                  onPress={requestPermission}
                />
              </>
            )}
          </SSVStack>
          <SSButton
            variant="secondary"
            label={t('common.paste')}
            disabled={!hasToPaste}
            onPress={handlePaste}
          />
        </SSVStack>
      </SSMainLayout>
    </View>
  )
}
