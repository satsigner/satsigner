import { Redirect } from 'expo-router'
import { lazy, Suspense, useEffect } from 'react'
import { View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { useAuthHydrated } from '@/hooks/useAuthHydrated'
import { useAuthStore } from '@/store/auth'
import { Colors } from '@/styles'
import { loadAuthenticatedSession } from '@/utils/authenticatedSession'

const AuthenticatedSession = lazy(loadAuthenticatedSession)

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

  useEffect(() => {
    if (!hydrated || !(lockTriggered && skipPin)) {
      return
    }
    void loadAuthenticatedSession()
    setLockTriggered(false)
  }, [hydrated, lockTriggered, skipPin, setLockTriggered])

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
