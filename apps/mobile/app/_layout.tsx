import '@/utils/polyfills'
import { DarkTheme, ThemeProvider } from '@react-navigation/native'
import { QueryClientProvider } from '@tanstack/react-query'
import { Slot } from 'expo-router'
import * as SystemUI from 'expo-system-ui'
import { useEffect, useRef, useState } from 'react'
import {
  AppState,
  type AppStateStatus,
  Platform,
  StyleSheet,
  View
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import NfcManager from 'react-native-nfc-manager'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Toaster } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { useBarkAccessTokenDeepLink } from '@/hooks/useBarkAccessTokenDeepLink'
import { queryClient } from '@/lib/queryClient'
import {
  getLastBackgroundTimestamp,
  setLastBackgroundTimestamp
} from '@/storage/mmkv'
import { useAuthStore } from '@/store/auth'
import { Colors } from '@/styles'

if (Platform.OS === 'android') {
  SystemUI.setBackgroundColorAsync(Colors.gray[950])
}

const appTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.gray[950]
  }
}

function BarkAccessTokenDeepLinkBridge() {
  useBarkAccessTokenDeepLink()
  return null
}

export default function RootLayout() {
  const [firstTime, setLockTriggered, requiresAuth, lockDeltaTime] =
    useAuthStore(
      useShallow((state) => [
        state.firstTime,
        state.setLockTriggered,
        state.requiresAuth,
        state.lockDeltaTime
      ])
    )

  const appState = useRef(AppState.currentState)
  const [privacyScreenVisible, setPrivacyScreenVisible] = useState(false)

  useEffect(() => {
    if (!firstTime) {
      setLockTriggered(true)
    }

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChanged
    )

    return () => {
      subscription.remove()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function initNfc() {
      try {
        await NfcManager.start()
      } catch {
        // Show a toast notification only in development
        // turn this off for now, too annoying!!
        // if (__DEV__) {
        //   toast.error('NFC initialization failed', {
        //     description:
        //       'This is expected in emulators and devices without NFC support'
        //   })
        // }
      }
    }
    initNfc()
  }, [])

  function handleAppStateChanged(nextAppState: AppStateStatus) {
    if (nextAppState === 'background' && requiresAuth) {
      setPrivacyScreenVisible(true)
      setLastBackgroundTimestamp(Date.now())
    } else if (
      nextAppState === 'active' &&
      appState.current.match(/background/) &&
      requiresAuth
    ) {
      const inactivityStartTime = getLastBackgroundTimestamp()
      const elapsed = (Date.now() - (inactivityStartTime || 0)) / 1000

      if (elapsed >= lockDeltaTime) {
        setLockTriggered(true)
      }

      // Keep the overlay visible briefly so the /unlock redirect renders
      // before the previous screen becomes visible
      setTimeout(() => setPrivacyScreenVisible(false), 300)
    } else if (nextAppState === 'active') {
      setPrivacyScreenVisible(false)
    }

    appState.current = nextAppState
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <BarkAccessTokenDeepLinkBridge />
        <GestureHandlerRootView style={styles.root}>
          <ThemeProvider value={appTheme}>
            <View style={styles.container}>
              <Slot />
            </View>
          </ThemeProvider>
          {privacyScreenVisible && <View style={styles.privacyScreen} />}
          <Toaster
            theme="dark"
            position="top-center"
            style={{
              backgroundColor: Colors.gray[950],
              borderColor: Colors.gray[800],
              borderRadius: 8,
              borderWidth: 1,
              zIndex: 999999
            }}
          />
        </GestureHandlerRootView>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray[950],
    flex: 1
  },
  privacyScreen: {
    backgroundColor: Colors.gray[950],
    inset: 0,
    position: 'absolute',
    zIndex: 999
  },
  root: {
    flex: 1
  }
})
