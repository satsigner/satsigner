import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import {
  DEFAULT_LOCK_DELTA_TIME_SECONDS,
  DEFAULT_PIN_MAX_TRIES
} from '@/config/auth'
import { getItem, setItem } from '@/storage/encrypted'
import mmkvStorage from '@/storage/mmkv'
import { PageRoute } from '@/types/navigation/pageParams'
import { formatPageUrl } from '@/utils/format'

const PIN_KEY = 'satsigner_pin'

type AuthState = {
  firstTime: boolean
  requiresAuth: boolean
  lockTriggered: boolean
  lockDeltaTime: number
  pinTries: number
  pinMaxTries: number
  lastVisitedPage: PageRoute
}

type AuthAction = {
  setFirstTime: (firstTime: boolean) => void
  setRequiresAuth: (requiresAuth: boolean) => void
  setLockTriggered: (lockTriggered: boolean) => void
  setPin: (pin: string) => Promise<void>
  validatePin: (pin: string) => Promise<boolean>
  incrementPinTries: () => number
  resetPinTries: () => void
  setPinMaxTries: (maxTries: number) => void
  setLockDeltaTime: (deltaTime: number) => void
  getLastVisitedPageUrl: () => string
  setLastVisitedPage: (page: PageRoute) => void
}

const useAuthStore = create<AuthState & AuthAction>()(
  persist(
    (set, get) => ({
      firstTime: true,
      requiresAuth: false,
      lockTriggered: false,
      lockDeltaTime: DEFAULT_LOCK_DELTA_TIME_SECONDS,
      pinTries: 0,
      pinMaxTries: DEFAULT_PIN_MAX_TRIES,
      lastVisitedPage: {
        path: '',
        params: {}
      },
      setFirstTime: (firstTime: boolean) => {
        set({ firstTime })
      },
      setRequiresAuth: (requiresAuth) => {
        set({ requiresAuth })
      },
      setLockTriggered: (lockTriggered) => {
        set({ lockTriggered })
      },
      setPin: async (pin) => {
        await setItem(PIN_KEY, pin)
      },
      validatePin: async (pin) => {
        const savedPin = await getItem(PIN_KEY)
        return pin === savedPin
      },
      incrementPinTries: () => {
        set({ pinTries: get().pinTries + 1 })
        const triesLeft = get().pinMaxTries - get().pinTries
        return triesLeft
      },
      resetPinTries: () => {
        set({ pinTries: 0 })
      },
      setPinMaxTries: (maxTries) => {
        set({ pinMaxTries: maxTries })
      },
      setLockDeltaTime: (deltaTime) => {
        set({ lockDeltaTime: deltaTime })
      },
      getLastVisitedPageUrl: () => {
        const { path, params } = get().lastVisitedPage
        return formatPageUrl(path, params)
      },
      setLastVisitedPage: (lastVisitedPage: PageRoute) => {
        set({ lastVisitedPage })
      }
    }),
    {
      name: 'satsigner-auth',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useAuthStore }
