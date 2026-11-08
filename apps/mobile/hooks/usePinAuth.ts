import { router } from 'expo-router'
import { type SetStateAction, useState } from 'react'
import { toast } from 'sonner-native'

import { DURESS_PIN_KEY, SALT_KEY } from '@/config/auth'
import { useStoredPinLength } from '@/hooks/useStoredPinLength'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAuthStore } from '@/store/auth'
import { loadAuthenticatedSession } from '@/utils/authenticatedSession'
import { emptyPin, getPin } from '@/utils/pin'
import { toPinAttempts } from '@/utils/pinAttempts'
import {
  applyPendingPinKdfCommit,
  derivePinDigest,
  getStoredKdfConfig,
  pinMatchesDuressDigest,
  safeEqualHex
} from '@/utils/pinKdf'
import { applyPendingPinRekey } from '@/utils/pinRekey'
import { finalizePinAuthSuccess, promoteDuressPin } from '@/utils/pinUnlock'
import {
  isDuressPinRemoved,
  secureWipeAfterMaxPinTries,
  secureWipeAllWalletData
} from '@/utils/secureWipe'

type PinAuthResult = 'error' | 'duress' | 'fail' | 'success'

type UsePinAuthProps = {
  onSuccess: () => void | Promise<void>
  onTriesOver?: () => void
  maxTries?: number
}

function applyPinUpdate(update: SetStateAction<string[]>, current: string[]) {
  return typeof update === 'function' ? update(current) : update
}

// Unlocks the app into the (now wiped) wallet after a duress PIN.
async function unlockAfterDuress() {
  await loadAuthenticatedSession()
  const { setLockTriggered, setJustUnlocked, resetPinTries } =
    useAuthStore.getState()
  setLockTriggered(false)
  setJustUnlocked(true)
  resetPinTries()
  // An in-app PIN prompt sits on a stack of the wiped account's screens. The
  // root /unlock has nothing to dismiss, and dismissAll() there only warns.
  if (router.canDismiss()) {
    router.dismissAll()
  }
  router.replace('/')
}

async function checkPin(
  inputPin: string,
  duressPinEnabled: boolean,
  onSuccess: () => void | Promise<void>
): Promise<PinAuthResult> {
  await applyPendingPinKdfCommit()
  // A re-key that cannot finish now is retried on the next check; failing
  // here would make every unlock an error and lock the user out for good.
  await applyPendingPinRekey().catch(() => undefined)

  const hashedPin = await getPin()
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
    try {
      if (await isDuressPinRemoved()) {
        await promoteDuressPin(inputPin)
      }
    } catch {
      // Same as the wipe: a failure must not reveal the duress unlock.
    }
    return 'duress'
  }

  const mainKdf = await getStoredKdfConfig()
  const hashedInput = await derivePinDigest(inputPin, salt, mainKdf)

  if (!safeEqualHex(hashedInput, hashedPin)) {
    return 'fail'
  }

  await finalizePinAuthSuccess(inputPin, salt, hashedPin, onSuccess)
  return 'success'
}

function isPinAttemptsExhausted() {
  const { pinTries, pinMaxTries } = useAuthStore.getState()
  return toPinAttempts(pinTries, pinMaxTries).status === 'exhausted'
}

// Core PIN verification orchestration. Kept free of component state so it can
// be tested directly. The duress branch wipes wallet data and the success
// branch finalizes the unlock; navigation is left to the caller. Never throws:
// any storage or KDF failure resolves to 'error' so the caller cannot get stuck
// verifying.
async function verifyPin(
  inputPin: string,
  duressPinEnabled: boolean,
  onSuccess: () => void | Promise<void>
): Promise<PinAuthResult> {
  try {
    return await checkPin(inputPin, duressPinEnabled, onSuccess)
  } catch {
    return 'error'
  }
}

function usePinAuth({ onSuccess, onTriesOver, maxTries }: UsePinAuthProps) {
  const duressPinEnabled = useAuthStore((state) => state.duressPinEnabled)
  const pinLength = useStoredPinLength()
  const [enteredPin, setEnteredPin] = useState<string[] | null>(null)
  const [tries, setTries] = useState(0)
  const [verifying, setVerifying] = useState(false)

  const pin =
    enteredPin ?? (pinLength === undefined ? null : emptyPin(pinLength))

  function setPin(update: SetStateAction<string[]>) {
    if (pinLength === undefined) {
      return
    }
    setEnteredPin((current) =>
      applyPinUpdate(update, current ?? emptyPin(pinLength))
    )
  }

  // Every prompt counts against the persisted tries, so closing a prompt or
  // restarting the app cannot reset them. The pad stays disabled while the
  // wipe after the last try runs.
  async function wipeAfterMaxTries() {
    const wiped = await secureWipeAfterMaxPinTries()
    if (!wiped) {
      toast.error(t('auth.wipeFailed'))
      setEnteredPin(null)
      setVerifying(false)
      return
    }
    if (router.canDismiss()) {
      router.dismissAll()
    }
    router.replace('/')
  }

  async function handleFailedAttempt() {
    setEnteredPin(null)

    const newTries = tries + 1
    setTries(newTries)
    if (maxTries && newTries >= maxTries && onTriesOver) {
      onTriesOver()
    }

    const remainingTries = useAuthStore.getState().incrementPinTries()
    if (remainingTries > 0) {
      setVerifying(false)
      return
    }
    await wipeAfterMaxTries()
  }

  async function handleFillEnded(inputPin: string) {
    setVerifying(true)
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })

    if (isPinAttemptsExhausted()) {
      await wipeAfterMaxTries()
      return
    }

    const result = await verifyPin(inputPin, duressPinEnabled, onSuccess)

    if (result === 'duress') {
      await unlockAfterDuress()
      return
    }

    if (result === 'error') {
      setVerifying(false)
      setEnteredPin(null)
      toast.error(t('auth.pinRetrieveFailed'))
      return
    }

    if (result === 'fail') {
      await handleFailedAttempt()
      return
    }

    useAuthStore.getState().resetPinTries()
  }

  return {
    handleFillEnded,
    pin,
    setPin,
    verifying
  }
}

export { type UsePinAuthProps, usePinAuth, verifyPin }
