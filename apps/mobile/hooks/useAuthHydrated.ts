import { useSyncExternalStore } from 'react'

import { useAuthStore } from '@/store/auth'

function subscribeAuthHydration(onStoreChange: () => void) {
  const unsubscribe = useAuthStore.persist.onFinishHydration(onStoreChange)
  if (typeof unsubscribe === 'function') {
    return unsubscribe
  }
  return () => undefined
}

function getAuthHydrated() {
  return useAuthStore.persist.hasHydrated()
}

function useAuthHydrated() {
  return useSyncExternalStore(
    subscribeAuthHydration,
    getAuthHydrated,
    getAuthHydrated
  )
}

export { useAuthHydrated }
