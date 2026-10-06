import { router } from 'expo-router'
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import { toast } from 'sonner-native'

import { DURESS_PIN_KEY, PIN_LENGTH_KEY, SALT_KEY } from '@/config/auth'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAuthStore } from '@/store/auth'
import { loadAuthenticatedSession } from '@/utils/authenticatedSession'
import { clampPinLength, emptyPin, getPin } from '@/utils/pin'
import {
  applyPendingPinKdfCommit,
  derivePinDigest,
  getStoredKdfConfig,
  pinMatchesDuressDigest,
  safeEqualHex
} from '@/utils/pinKdf'
import { finalizePinAuthSuccess } from '@/utils/pinUnlock'
import { secureWipeAllWalletData } from '@/utils/secureWipe'

type PinAuthResult = 'error' | 'duress' | 'fail' | 'success'

type UsePinAuthProps = {
  onFail?: () => void
  onSuccess: () => void | Promise<void>
  onTriesOver?: () => void
  maxTries?: number
}

function applyPinUpdate(
  update: SetStateAction<string[]>,
  setPin: Dispatch<SetStateAction<string[] | null>>
) {
  setPin((current) => {
    if (current === null) {
      return current
    }
    if (typeof update === 'function') {
      return update(current)
    }
    return update
  })
}

// Unlocks the app into the (now wiped) wallet after a duress PIN.
async function unlockAfterDuress() {
  await loadAuthenticatedSession()
  const { setLockTriggered, setJustUnlocked, resetPinTries } =
    useAuthStore.getState()
  setLockTriggered(false)
  setJustUnlocked(true)
  resetPinTries()
  router.dismissAll()
  router.replace('/')
}

// Core PIN verification orchestration. Kept free of component state so it can
// be tested directly. The duress branch wipes wallet data and the success
// branch finalizes the unlock; navigation is left to the caller.
async function verifyPin(
  inputPin: string,
  duressPinEnabled: boolean,
  onSuccess: () => void | Promise<void>
): Promise<PinAuthResult> {
  try {
    await applyPendingPinKdfCommit()
  } catch {
    return 'error'
  }

  const hashedPin = await getPin().catch(() => null)
  const hashedDuressPin = await getItem(DURESS_PIN_KEY)
  const salt = await getItem(SALT_KEY)
  if (!hashedPin || !salt) {
    return 'error'
  }

  if (
    duressPinEnabled &&
    hashedDuressPin &&
    (await pinMatchesDuressDigest(inputPin, hashedDuressPin))
  ) {
    try {
      await secureWipeAllWalletData()
    } catch {
      // Duress wipe is best-effort; always proceed to unlock the app.
    }
    return 'duress'
  }

  const mainKdf = await getStoredKdfConfig()
  const hashedInput = await derivePinDigest(inputPin, salt, mainKdf)

  if (!safeEqualHex(hashedInput, hashedPin)) {
    return 'fail'
  }

  try {
    await finalizePinAuthSuccess(inputPin, salt, hashedPin, onSuccess)
  } catch {
    return 'error'
  }
  return 'success'
}

function usePinAuth({
  onFail,
  onSuccess,
  onTriesOver,
  maxTries
}: UsePinAuthProps) {
  const duressPinEnabled = useAuthStore((state) => state.duressPinEnabled)
  const [pin, setPin] = useState<string[] | null>(null)
  const [tries, setTries] = useState(0)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    const load = { cancelled: false }
    async function loadPinLength() {
      const stored = await getItem(PIN_LENGTH_KEY)
      if (load.cancelled) {
        return
      }
      const length = clampPinLength(stored ? Number(stored) : Number.NaN)
      setPin((current) => current ?? emptyPin(length))
    }
    loadPinLength()
    return () => {
      load.cancelled = true
    }
  }, [])

  async function handleFillEnded(inputPin: string) {
    setVerifying(true)
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })

    const result = await verifyPin(inputPin, duressPinEnabled, onSuccess)

    if (result === 'duress') {
      await unlockAfterDuress()
      return
    }

    if (result === 'error') {
      setVerifying(false)
      setPin((current) => (current ? emptyPin(current.length) : current))
      toast.error(t('auth.pinRetrieveFailed'))
      return
    }

    if (result === 'fail') {
      setVerifying(false)
      setPin((current) => (current ? emptyPin(current.length) : current))

      const newTries = tries + 1
      setTries(newTries)
      if (maxTries && newTries >= maxTries && onTriesOver) {
        onTriesOver()
      }

      if (onFail) {
        onFail()
      }
    }
    // 'success' finalized the unlock; nothing to do.
  }

  return {
    handleFillEnded,
    pin,
    setPin: (update: SetStateAction<string[]>) =>
      applyPinUpdate(update, setPin),
    verifying
  }
}

export { type UsePinAuthProps, usePinAuth, verifyPin }
