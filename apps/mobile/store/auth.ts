import crypto from 'react-native-aes-crypto'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import {
  DEFAULT_LOCK_DELTA_TIME_SECONDS,
  DEFAULT_PIN_MAX_TRIES
} from '@/config/auth'
import { getItem, setItem } from '@/storage/encrypted'
import mmkvStorage from '@/storage/mmkv'
import { PageRoute } from '@/types/navigation/page'
import { formatPageUrl } from '@/utils/format'

export const PIN_KEY = 'satsigner_pin'

type AuthState = {
  firstTime: boolean
  requiresAuth: boolean
  lockTriggered: boolean
  lockDeltaTime: number
  pinTries: number
  pinMaxTries: number
  pageHistory: string[]
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
  markPageVisited: (page: PageRoute) => void
  getPagesHistory: () => string[]
  clearPageHistory: () => void
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
      pageHistory: [],
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
        const hashedPin = await crypto.sha256(await crypto.sha256(pin))
        await setItem(PIN_KEY, hashedPin)
      },
      validatePin: async (pin) => {
        const hashedPin = await crypto.sha256(await crypto.sha256(pin))
        const savedPin = await getItem(PIN_KEY)
        return hashedPin === savedPin
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
      markPageVisited: (page: PageRoute) => {
        const pages = get().pageHistory
        const { path, params } = page
        const actualPage = formatPageUrl(path, params)
        const lastPage = () => pages[pages.length - 1]

        // pop-out page if not a sub-page
        if (pages.length > 0 && !actualPage.startsWith(lastPage())) {
          pages.pop()
        }

        // when navigating backwards, pop-out page to prevent duplicate
        if (pages.length > 0 && actualPage === lastPage()) {
          pages.pop()
        }

        pages.push(actualPage)
        set({ pageHistory: pages })
      },
      getPagesHistory: () => {
        return ['/', ...get().pageHistory]
      },
      clearPageHistory() {
        set({ pageHistory: [] })
      }
    }),
    {
      name: 'satsigner-auth',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useAuthStore }
