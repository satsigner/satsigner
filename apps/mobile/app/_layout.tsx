import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Slot } from 'expo-router'
import { setStatusBarStyle } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useEffect, useRef } from 'react'
import {
  AppState,
  type AppStateStatus,
  Platform,
  StyleSheet,
  UIManager
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import NfcManager from 'react-native-nfc-manager'
import { Toaster } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import {
  getLastBackgroundTimestamp,
  setLastBackgroundTimestamp
} from '@/storage/mmkv'
import { useAuthStore } from '@/store/auth'
import { Colors } from '@/styles'

if (Platform.OS === 'android') {
  SystemUI.setBackgroundColorAsync(Colors.gray[950])

  if (UIManager.setLayoutAnimationEnabledExperimental)
    UIManager.setLayoutAnimationEnabledExperimental(true)
}

const queryClient = new QueryClient()

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

  useEffect(() => {
    setTimeout(() => {
      setStatusBarStyle('light')
    }, 1)
  }, []) // Workaround for now to set the statusBarStyle

  useEffect(() => {
    if (!firstTime) setLockTriggered(true)

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChanged
    )

    return () => {
      subscription.remove()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Initialize NFC manager
    NfcManager.start()
  }, [])

  function handleAppStateChanged(nextAppState: AppStateStatus) {
    if (nextAppState === 'background' && requiresAuth) {
      setLastBackgroundTimestamp(Date.now())
    } else if (
      nextAppState === 'active' &&
      appState.current.match(/background/) &&
      requiresAuth
    ) {
      const inactivityStartTime = getLastBackgroundTimestamp()
      const elapsed = (Date.now() - (inactivityStartTime || 0)) / 1000

      if (elapsed >= lockDeltaTime) setLockTriggered(true)
    }

    appState.current = nextAppState
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={styles.container}>
        <Slot />
        <Toaster
          theme="dark"
          position="top-center"
          style={{
            borderRadius: 8,
            backgroundColor: Colors.gray[950],
            borderWidth: 1,
            borderColor: Colors.gray[800]
          }}
        />
      </GestureHandlerRootView>
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray[950]
  }
})
