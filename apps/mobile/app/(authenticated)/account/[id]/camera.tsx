import { Camera as ExpoCamera } from 'expo-camera'
import * as Clipboard from 'expo-clipboard'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { AppState, AppStateStatus, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { Colors, Layout } from '@/styles'

export default function Camera() {
  const [startCamera, setStartCamera] = useState(false)
  const [hasToPaste, setHasToPaste] = useState(false)

  const appState = useRef(AppState.currentState)

  async function handleAppStateChanged(nextAppState: AppStateStatus) {
    if (nextAppState === 'active') await handleHasToPaste()

    appState.current = nextAppState
  }

  async function handleHasToPaste() {
    const text = await Clipboard.getStringAsync()
    setHasToPaste(!!text)
  }

  useEffect(() => {
    ;(async () => {
      await handleHasToPaste()
    })()

    const clipboardListener = Clipboard.addClipboardListener(() => {
      Clipboard.getStringAsync().then((content) => setHasToPaste(!!content))
    })

    const appStateListener = AppState.addEventListener(
      'change',
      handleAppStateChanged
    )

    return () => {
      appStateListener.remove()
      Clipboard.removeClipboardListener(clipboardListener)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const __startCamera = async () => {
    const { status } = await ExpoCamera.requestCameraPermissionsAsync()
    if (status === 'granted') {
      // start the camera
      setStartCamera(true)
    } else {
      console.log('else')
    }
  }

  return (
    <View style={{ position: 'relative' }}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>Scan QRCode</SSText>,
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
      <ExpoCamera style={{ width: '100%', height: '100%' }} />
      <SSMainLayout
        style={{
          paddingBottom: Layout.mainContainer.paddingBottom,
          position: 'absolute',
          top: 0,
          opacity: 0.3,
          height: '100%'
        }}
      >
        <SSVStack justifyBetween>
          <SSVStack itemsCenter>
            <View
              style={{
                borderColor: Colors.gray[700],
                borderWidth: 2,
                aspectRatio: 1,
                borderRadius: 10,
                width: '100%'
              }}
            />
            {startCamera ? (
              <SSText center style={{ maxWidth: 250 }}>
                Scan any Bitcoin or Lightning related QR code.
              </SSText>
            ) : (
              <>
                <SSText center style={{ maxWidth: 250 }}>
                  Enable camera access in your phone's settings to scan a
                  QRCode.
                </SSText>
                <SSButton
                  label="Enable Camera Access"
                  onPress={() => __startCamera()}
                />
              </>
            )}
          </SSVStack>
          <SSButton variant="secondary" label="Paste" disabled={!hasToPaste} />
        </SSVStack>
      </SSMainLayout>
    </View>
  )
}
