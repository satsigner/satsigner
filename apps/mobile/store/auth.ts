import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import {
  DEFAULT_LOCK_DELTA_TIME_SECONDS,
  DEFAULT_PIN_MAX_TRIES,
  DURESS_PIN_KEY,
  PIN_KEY,
  SALT_KEY
} from '@/config/auth'
import { getItem, setItem } from '@/storage/encrypted'
import mmkvStorage from '@/storage/mmkv'
import { type PageRoute } from '@/types/navigation/page'
import { generateSalt, getPin, pbkdf2Encrypt, randomKey } from '@/utils/crypto'
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
  /**
   * Set when a legacy production `skipPin` flag is cleared on rehydrate. These
   * users silently had their PIN set to `DEFAULT_PIN`; they must be routed to
   * set a real PIN without being asked for a current one they never chose.
   */
  requirePinMigration: boolean
  /** Decrypted backup JSON; when set, recovery runs after next unlock. Not persisted. */
  pendingRecoverData: string | null
}

type AuthAction = {
  setFirstTime: (firstTime: boolean) => void
  setRequiresAuth: (requiresAuth: boolean) => void
  setLockTriggered: (lockTriggered: boolean) => void
  setPin: (pin: string) => Promise<void>
  setDuressPin: (pin: string) => Promise<void>
  setSkipPin: (skipPin: boolean) => void
  setDuressPinEnabled: (duressPinEnabled: boolean) => void
  /**
   * Dev-only: skip lock screen and ensure encryption key material exists.
   * Uses a random ephemeral passphrase (never a hardcoded PIN) when none is set.
   */
  enableDevSkipPin: () => Promise<void>
  validatePin: (pin: string) => Promise<boolean>
  incrementPinTries: () => number
  resetPinTries: () => void
  setPinMaxTries: (maxTries: number) => void
  setLockDeltaTime: (deltaTime: number) => void
  markPageVisited: (page: PageRoute) => void
  getPagesHistory: () => string[]
  clearPageHistory: () => void
  setJustUnlocked: (justUnlocked: AuthState['justUnlocked']) => void
  setPendingRecoverData: (data: string | null) => void
  setRequirePinMigration: (requirePinMigration: boolean) => void
}

const useAuthStore = create<AuthState & AuthAction>()(
  persist(
    (set, get) => ({
      clearPageHistory() {
        set({ pageHistory: [] })
      },
      duressPinEnabled: false,
      enableDevSkipPin: async () => {
        if (!__DEV__) {
          return
        }
        try {
          await getPin()
        } catch {
          // High-entropy throwaway passphrase; only its PBKDF2 digest is kept.
          const ephemeral = await randomKey(32)
          const salt = await generateSalt()
          const digest = await pbkdf2Encrypt(ephemeral, salt)
          await setItem(SALT_KEY, salt)
          await setItem(PIN_KEY, digest)
        }
        set({ skipPin: true })
      },
      firstTime: true,
      getPagesHistory: () => ['/', ...get().pageHistory],
      incrementPinTries: () => {
        set({ pinTries: get().pinTries + 1 })
        const triesLeft = get().pinMaxTries - get().pinTries
        return triesLeft
      },
      justUnlocked: false,
      lockDeltaTime: DEFAULT_LOCK_DELTA_TIME_SECONDS,
      lockTriggered: false,
      markPageVisited: (page: PageRoute) => {
        const pages = get().pageHistory
        const { path, params } = page
        const actualPage = formatPageUrl(path, params)
        const lastPage = () => pages.at(-1)!

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
      pageHistory: [],
      pendingRecoverData: null,
      pinMaxTries: DEFAULT_PIN_MAX_TRIES,
      pinTries: 0,
      requirePinMigration: false,
      requiresAuth: false,
      resetPinTries: () => {
        set({ pinTries: 0 })
      },
      setDuressPin: async (pin) => {
        const salt = await generateSalt()
        const encryptedPin = await pbkdf2Encrypt(pin, salt)
        await setItem(SALT_KEY, salt)
        await setItem(DURESS_PIN_KEY, encryptedPin)
      },
      setDuressPinEnabled(duressPinEnabled) {
        set({ duressPinEnabled })
      },
      setFirstTime: (firstTime: boolean) => {
        set({ firstTime })
      },
      setJustUnlocked(justUnlocked) {
        set({ justUnlocked })
      },
      setLockDeltaTime: (deltaTime) => {
        set({ lockDeltaTime: deltaTime })
      },
      setLockTriggered: (lockTriggered) => {
        set({ lockTriggered })
      },
      setPendingRecoverData(pendingRecoverData) {
        set({ pendingRecoverData })
      },
      setPin: async (pin) => {
        const salt = await generateSalt()
        const encryptedPin = await pbkdf2Encrypt(pin, salt)
        await setItem(SALT_KEY, salt)
        await setItem(PIN_KEY, encryptedPin)
      },
      setPinMaxTries: (maxTries) => {
        set({ pinMaxTries: maxTries })
      },
      setRequirePinMigration: (requirePinMigration) => {
        set({ requirePinMigration })
      },
      setRequiresAuth: (requiresAuth) => {
        set({ requiresAuth })
      },
      setSkipPin(skipPin) {
        // Lock-screen bypass is development-only. Production builds ignore it.
        if (!__DEV__ && skipPin) {
          set({ skipPin: false })
          return
        }
        set({ skipPin })
      },
      skipPin: false,
      validatePin: async (pin) => {
        const salt = await getItem(SALT_KEY)
        if (!salt) {
          throw new Error('Failed to validate PIN')
        }
        const encrypted = await pbkdf2Encrypt(pin, salt)
        const savedPin = await getPin()
        return encrypted === savedPin
      }
    }),
    {
      name: 'satsigner-auth',
      onRehydrateStorage: () => (state) => {
        // Persisted skipPin must never unlock production builds.
        if (!__DEV__ && state?.skipPin) {
          state.skipPin = false
          // Legacy skip users are on DEFAULT_PIN; flag them to set a real PIN.
          state.requirePinMigration = true
        }
      },
      partialize: (state) => {
        const { pendingRecoverData: _, ...rest } = state
        return rest
      },
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useAuthStore }
