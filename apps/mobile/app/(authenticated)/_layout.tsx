import { Redirect } from 'expo-router'
import { lazy, Suspense } from 'react'
import { View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { useAuthHydrated } from '@/hooks/useAuthHydrated'
import { useAuthStore } from '@/store/auth'
import { Colors } from '@/styles'

const AuthenticatedSession = lazy(() => import('./_session'))

const authSplash = (
  <View style={{ backgroundColor: Colors.gray[950], flex: 1 }} />
)

export default function AuthenticatedLayout() {
  const hydrated = useAuthHydrated()
  const [firstTime, requiresAuth, lockTriggered, skipPin, setLockTriggered] =
    useAuthStore(
      useShallow((state) => [
        state.firstTime,
        state.requiresAuth,
        state.lockTriggered,
        state.skipPin,
        state.setLockTriggered
      ])
    )

  if (lockTriggered && skipPin) {
    setLockTriggered(false)
  }

  if (!hydrated) {
    return authSplash
  }

  if (firstTime) {
    return <Redirect href="/setPin" />
  }

  if (requiresAuth && lockTriggered && !skipPin) {
    return <Redirect href="/unlock" />
  }

  return (
    <Suspense fallback={authSplash}>
      <AuthenticatedSession />
    </Suspense>
  )
}
