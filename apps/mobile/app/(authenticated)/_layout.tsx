import '@/shim'

import {
  getFocusedRouteNameFromRoute,
  useRoute
} from '@react-navigation/native'
import { Redirect, Stack, useGlobalSearchParams, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconSettings } from '@/components/icons'
import SSIconButton from '@/components/SSIconButton'
import { useAuthStore } from '@/store/auth'
import { Colors } from '@/styles'
import { type PageRoute } from '@/types/navigation/page'

export default function AuthenticatedLayout() {
  const router = useRouter()
  const [
    firstTime,
    requiresAuth,
    lockTriggered,
    skipPin,
    setLockTriggered,
    markPageVisited,
    getPagesHistory,
    clearPageHistory
  ] = useAuthStore(
    useShallow((state) => [
      state.firstTime,
      state.requiresAuth,
      state.lockTriggered,
      state.skipPin,
      state.setLockTriggered,
      state.markPageVisited,
      state.getPagesHistory,
      state.clearPageHistory
    ])
  )

  const routeName = getFocusedRouteNameFromRoute(useRoute()) || ''
  const routeParams = useGlobalSearchParams()

  useEffect(() => {
    if (lockTriggered && skipPin) {
      setLockTriggered(false)
      const pages = getPagesHistory()
      clearPageHistory()
      setImmediate(() => {
        for (const page of pages) {
          router.push(page as any)
        }
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (firstTime) return <Redirect href="/setPin" />

  if (requiresAuth && lockTriggered && !skipPin)
    return <Redirect href="/unlock" />

  // Do not push index route
  if (routeName !== '' && routeName !== 'index') {
    const {
      params: _paramsUnused,
      screen: _screenUnused,
      ...filteredRouteParams
    } = routeParams

    markPageVisited({
      path: routeName,
      params: filteredRouteParams
    } as PageRoute)
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          contentStyle: {
            backgroundColor: Colors.gray[950]
          },
          headerBackground: () => (
            <View
              style={{
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: Colors.gray[950]
              }}
            />
          ),
          headerRight: () => (
            <SSIconButton onPress={() => router.navigate('/settings/')}>
              <SSIconSettings height={18} width={18} />
            </SSIconButton>
          ),
          headerTitleAlign: 'center',
          headerTintColor: Colors.gray[200],
          headerBackTitleVisible: false
        }}
      />
      <StatusBar style="light" />
    </View>
  )
}
