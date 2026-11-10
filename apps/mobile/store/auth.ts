import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import {
  DEFAULT_LOCK_DELTA_TIME_SECONDS,
  DEFAULT_PIN_MAX_TRIES,
  DURESS_KDF_KEY,
  DURESS_PIN_KEY,
  PIN_KDF_COMMIT_KEY,
  PIN_KDF_KEY,
  PIN_KEY,
  PIN_LENGTH_KEY,
  PIN_REKEY_JOURNAL_KEY,
  RANDOM_PIN_BYTE_LENGTH,
  SALT_KEY,
  SALT_KEY_DURESS
} from '@/config/auth'
import { deleteItem, getItem, setItem } from '@/storage/encrypted'
import mmkvStorage from '@/storage/mmkv'
import { type PageRoute } from '@/types/navigation/page'
import { randomKey } from '@/utils/crypto'
import { formatPageUrl } from '@/utils/format'
import { isRecord } from '@/utils/object'
import { getPin } from '@/utils/pin'
import { clampPinTries } from '@/utils/pinAttempts'
import {
  commitPinMaterial,
  derivePinDigest,
  getBestAvailableKdf,
  getStoredKdfConfig,
  preparePinMaterial,
  safeEqualHex,
  storeKdfConfig
} from '@/utils/pinKdf'
import { setSessionPinDigest } from '@/utils/pinSession'

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
  /**
   * Public server a restored backup switched to. Persisted so wallets stay
   * unsynced across a lock or relaunch until the user accepts it.
   */
  restoredPublicServerName: string | null
}

function applyColdStartLock(state: {
  lockTriggered: boolean
  requiresAuth: boolean
  skipPin: boolean
}) {
  if (state.requiresAuth && !state.skipPin) {
    state.lockTriggered = true
  }
}

type AuthAction = {
  setFirstTime: (firstTime: boolean) => void
  setRequiresAuth: (requiresAuth: boolean) => void
  setLockTriggered: (lockTriggered: boolean) => void
  setPin: (pin: string) => Promise<void>
  setDuressPin: (pin: string) => Promise<void>
  clearPin: () => Promise<void>
  clearDuressPin: () => Promise<void>
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
  setRestoredPublicServerName: (name: string | null) => void
  setRequirePinMigration: (requirePinMigration: boolean) => void
}

const AUTH_PERSIST_VERSION = 1

/**
 * Version 1 brings failed tries persisted at the limit back below it once:
 * lowering the limit used to keep the count, so the next correct PIN would
 * have wiped the wallet.
 */
function migrateAuthPersistedState(persisted: unknown, version: number) {
  if (version >= AUTH_PERSIST_VERSION || !isRecord(persisted)) {
    return persisted
  }
  const { pinMaxTries, pinTries } = persisted
  if (typeof pinTries !== 'number' || typeof pinMaxTries !== 'number') {
    return persisted
  }
  return { ...persisted, pinTries: clampPinTries(pinTries, pinMaxTries) }
}

const useAuthStore = create<AuthState & AuthAction>()(
  persist(
    (set, get) => ({
      clearDuressPin: async () => {
        const results = await Promise.allSettled([
          deleteItem(DURESS_PIN_KEY),
          deleteItem(DURESS_KDF_KEY),
          deleteItem(SALT_KEY_DURESS)
        ])
        if (results.some((result) => result.status === 'rejected')) {
          throw new Error('Failed to clear duress PIN')
        }
        set({ duressPinEnabled: false })
      },
      clearPageHistory() {
        set({ pageHistory: [] })
      },
      clearPin: async () => {
        const results = await Promise.allSettled([
          deleteItem(PIN_KDF_COMMIT_KEY),
          deleteItem(PIN_REKEY_JOURNAL_KEY),
          deleteItem(PIN_KEY),
          deleteItem(PIN_KDF_KEY),
          deleteItem(PIN_LENGTH_KEY),
          deleteItem(SALT_KEY)
        ])
        if (results.some((result) => result.status === 'rejected')) {
          throw new Error('Failed to clear PIN')
        }
        setSessionPinDigest(null)
      },
      duressPinEnabled: false,
      enableDevSkipPin: async () => {
        if (!__DEV__) {
          return
        }
        try {
          await getPin()
        } catch {
          // High-entropy throwaway passphrase; only its KDF digest is kept.
          await get().setPin(await randomKey(RANDOM_PIN_BYTE_LENGTH))
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
      restoredPublicServerName: null,
      setDuressPin: async (pin) => {
        // Reuse the main PIN salt. setPin also reuses that salt so a later
        // PIN change does not invalidate this digest.
        const salt = await getItem(SALT_KEY)
        if (!salt) {
          throw new Error('PIN must be set before setting a duress PIN')
        }
        const kdf = getBestAvailableKdf()
        const encryptedPin = await derivePinDigest(pin, salt, kdf)
        // A stored digest must never sit next to another PIN's KDF config:
        // drop the old digest, write the config, then the new digest.
        await deleteItem(DURESS_PIN_KEY)
        await storeKdfConfig(kdf, DURESS_KDF_KEY)
        await setItem(DURESS_PIN_KEY, encryptedPin)
        await deleteItem(SALT_KEY_DURESS).catch(() => undefined)
        set({ duressPinEnabled: true })
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
        if (lockTriggered) {
          setSessionPinDigest(null)
        }
        set({ lockTriggered })
      },
      setPendingRecoverData(pendingRecoverData) {
        set({ pendingRecoverData })
      },
      setPin: async (pin) => {
        const material = await preparePinMaterial(pin)
        await commitPinMaterial(material)
      },
      setPinMaxTries: (maxTries) => {
        set((state) => ({
          pinMaxTries: maxTries,
          pinTries: clampPinTries(state.pinTries, maxTries)
        }))
      },
      setRequirePinMigration: (requirePinMigration) => {
        set({ requirePinMigration })
      },
      setRequiresAuth: (requiresAuth) => {
        set({ requiresAuth })
      },
      setRestoredPublicServerName(restoredPublicServerName) {
        set({ restoredPublicServerName })
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
        const kdf = await getStoredKdfConfig()
        const encrypted = await derivePinDigest(pin, salt, kdf)
        const savedPin = await getPin()
        return safeEqualHex(encrypted, savedPin)
      }
    }),
    {
      migrate: migrateAuthPersistedState,
      name: 'satsigner-auth',
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return
        }
        // Persisted skipPin must never unlock production builds.
        if (!__DEV__ && state.skipPin) {
          state.skipPin = false
          // Legacy skip users are on DEFAULT_PIN; flag them to set a real PIN.
          state.requirePinMigration = true
        }
        // Always lock on launch so wallet/Ark/BDK work cannot start behind
        // the PIN screen (that freezes digit entry and the first unlocked frame).
        applyColdStartLock(state)
      },
      partialize: (state) => {
        const { pendingRecoverData: _, ...rest } = state
        return rest
      },
      storage: createJSONStorage(() => mmkvStorage),
      version: AUTH_PERSIST_VERSION
    }
  )
)

export { applyColdStartLock, migrateAuthPersistedState, useAuthStore }
