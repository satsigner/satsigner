import '@/utils/polyfills'
import { QueryClientProvider } from '@tanstack/react-query'
import { Slot } from 'expo-router'
import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation'
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
import { KeyboardProvider } from 'react-native-keyboard-controller'
import NfcManager from 'react-native-nfc-manager'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Toaster } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSDevConsole from '@/components/SSDevConsole'
import SSImageActionsSheet from '@/components/SSImageActionsSheet'
import SSIntroAnimation from '@/components/SSIntroAnimation'
import { PRIVACY_OVERLAY_HIDE_DELAY_MS } from '@/constants/privacy'
import { MS_PER_SECOND } from '@/constants/time'
import { queryClient } from '@/lib/queryClient'
import {
  getLastBackgroundTimestamp,
  setLastBackgroundTimestamp
} from '@/storage/mmkv'
import { useAuthStore } from '@/store/auth'
import { useDevConsoleStore } from '@/store/devConsole'
import { useIntroStore } from '@/store/intro'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import { Colors } from '@/styles'
import {
  type AppLifecycleStep,
  nextAppLifecycleStep
} from '@/utils/appLifecycle'
import { installDevConsole, isDevConsoleAvailable } from '@/utils/devConsole'
import { installDevErrorReporting } from '@/utils/devErrorReporting'

// Dev-only: crashes/rejections log symbolicated source file:line to the
// Metro console. Installed before any component code runs.
installDevErrorReporting()
installDevConsole()

const DEV_CONSOLE_AVAILABLE = isDevConsoleAvailable()

async function setAndroidBackgroundColor() {
  try {
    await SystemUI.setBackgroundColorAsync(Colors.gray[950])
  } catch {
    // Rejects when the activity is already gone; the color is only cosmetic.
  }
}

if (Platform.OS === 'android') {
  void setAndroidBackgroundColor()
}

const appTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.gray[950]
  }
}

export default function RootLayout() {
  const [firstTime, setLockTriggered] = useAuthStore(
    useShallow((state) => [state.firstTime, state.setLockTriggered])
  )

  const [introVisible, introForceFirstTime, hideIntro] = useIntroStore(
    useShallow((state) => [
      state.visible,
      state.forceFirstTime,
      state.hideIntro
    ])
  )

  const devConsoleEnabled = useDevConsoleStore((state) => state.enabled)

  const appState = useRef(AppState.currentState)
  const overlayHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [privacyScreenVisible, setPrivacyScreenVisible] = useState(false)
  const [authHydrated, setAuthHydrated] = useState(() =>
    useAuthStore.persist.hasHydrated()
  )
  const introOverlayVisible =
    authHydrated && introVisible && (firstTime || introForceFirstTime)

  useEffect(() => {
    if (authHydrated) {
      return
    }
    return useAuthStore.persist.onFinishHydration(() => {
      setAuthHydrated(true)
    })
  }, [authHydrated])

  function applyPrivacyOverlay(overlay: AppLifecycleStep['overlay']) {
    if (overlay === 'show' || overlay === 'hide') {
      setPrivacyScreenVisible(overlay === 'show')
      return
    }
    if (overlay === 'hideSoon') {
      overlayHideTimer.current = setTimeout(() => {
        overlayHideTimer.current = null
        setPrivacyScreenVisible(false)
      }, PRIVACY_OVERLAY_HIDE_DELAY_MS)
    }
  }

  // Registered once on mount, so auth settings are read from the store at
  // event time; render-time values would stay frozen at the first render.
  // A hide still pending from an earlier return must not fire after the app
  // went back to the background, or the screen shows in the app switcher.
  function handleAppStateChanged(nextAppState: AppStateStatus) {
    if (overlayHideTimer.current) {
      clearTimeout(overlayHideTimer.current)
      overlayHideTimer.current = null
    }
    const { requiresAuth, lockDeltaTime } = useAuthStore.getState()
    const step = nextAppLifecycleStep({
      lockDeltaTime,
      next: nextAppState,
      previous: appState.current,
      requiresAuth,
      secondsAway:
        (Date.now() - (getLastBackgroundTimestamp() || 0)) / MS_PER_SECOND
    })
    if (step.recordBackground) {
      setLastBackgroundTimestamp(Date.now())
    }
    if (step.lock) {
      setLockTriggered(true)
    }
    applyPrivacyOverlay(step.overlay)
    if (step.clearExpiredPayjoin) {
      usePayjoinSessionsStore.getState().clearExpiredSessions()
    }
    appState.current = nextAppState
  }

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
        // NFC init fails on emulators / devices without NFC — safe to ignore
      }
    }
    initNfc()
  }, [])

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={styles.root}>
          <KeyboardProvider>
            <ThemeProvider value={appTheme}>
              <View style={styles.container}>
                <Slot />
              </View>
            </ThemeProvider>
            {privacyScreenVisible && <View style={styles.privacyScreen} />}
            {introOverlayVisible ? (
              <SSIntroAnimation
                firstTime={firstTime || introForceFirstTime}
                onComplete={hideIntro}
              />
            ) : null}
            <SSImageActionsSheet />
            <Toaster
              theme="dark"
              position="top-center"
              style={{
                backgroundColor: Colors.gray[950],
                borderColor: Colors.gray[800],
                borderRadius: 8,
                borderWidth: 1,
                zIndex: 999_999
              }}
            />
            {DEV_CONSOLE_AVAILABLE && devConsoleEnabled ? (
              <SSDevConsole />
            ) : null}
          </KeyboardProvider>
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
