import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import {
  DEFAULT_LOCK_DELTA_TIME_SECONDS,
  DEFAULT_PIN_MAX_TRIES,
  DURESS_PIN_KEY,
  PIN_KEY
} from '@/config/auth'
import { getItem, setItem } from '@/storage/encrypted'
import mmkvStorage from '@/storage/mmkv'
import { type PageRoute } from '@/types/navigation/page'
import { doubleShaEncrypt } from '@/utils/crypto'
import { formatPageUrl } from '@/utils/format'

type AuthState = {
  firstTime: boolean
  requiresAuth: boolean
  lockTriggered: boolean
  lockDeltaTime: number
  pinTries: number
  pinMaxTries: number
  pageHistory: string[]
  skipPin: boolean
  duressPinEnabled: boolean
  justUnlocked: boolean
}

type AuthAction = {
  setFirstTime: (firstTime: boolean) => void
  setRequiresAuth: (requiresAuth: boolean) => void
  setLockTriggered: (lockTriggered: boolean) => void
  setPin: (pin: string) => Promise<void>
  setDuressPin: (pin: string) => Promise<void>
  setSkipPin: (skipPin: boolean) => void
  setDuressPinEnabled: (duressPinEnabled: boolean) => void
  validatePin: (pin: string) => Promise<boolean>
  incrementPinTries: () => number
  resetPinTries: () => void
  setPinMaxTries: (maxTries: number) => void
  setLockDeltaTime: (deltaTime: number) => void
  markPageVisited: (page: PageRoute) => void
  getPagesHistory: () => string[]
  clearPageHistory: () => void
  setJustUnlocked: (justUnlocked: AuthState['justUnlocked']) => void
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
      skipPin: false,
      duressPinEnabled: false,
      justUnlocked: false,
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
        const hashedPin = await doubleShaEncrypt(pin)
        await setItem(PIN_KEY, hashedPin)
      },
      setDuressPin: async (pin) => {
        const hashedDuressPin = await doubleShaEncrypt(pin)
        await setItem(DURESS_PIN_KEY, hashedDuressPin)
      },
      setSkipPin(skipPin) {
        set({ skipPin })
      },
      setDuressPinEnabled(duressPinEnabled) {
        set({ duressPinEnabled })
      },
      validatePin: async (pin) => {
        const hashedPin = await doubleShaEncrypt(pin)
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
      },
      setJustUnlocked(justUnlocked) {
        set({ justUnlocked })
      }
    }),
    {
      name: 'satsigner-auth',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useAuthStore }
