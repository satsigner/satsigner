import { DURESS_PIN_KEY, PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
import { useAuthStore } from '@/store/auth'
import { getPin, getStoredPinLength } from '@/utils/pin'
import {
  applyPendingPinKdfCommit,
  commitPinMaterial,
  type PinMaterial,
  pinMatchesDuressDigest,
  preparePinMaterial
} from '@/utils/pinKdf'
import { applyPendingPinRekey, clearPinRekeyJournal } from '@/utils/pinRekey'
import { setSessionPinDigest } from '@/utils/pinSession'

type PinChangeResult =
  | 'changed'
  | 'duressCleared'
  | 'duressClearFailed'
  | 'matchesDuress'
  | 'reEncryptFailed'

/**
 * Commits the new PIN, and decides by what actually landed when that throws:
 * once the commit journal holds the new digest the change is done (the next
 * PIN check finishes it), so only an earlier failure rolls the moved
 * secrets back to the old PIN.
 */
async function commitOrRollBack(material: PinMaterial): Promise<boolean> {
  try {
    await commitPinMaterial(material)
  } catch {
    await applyPendingPinKdfCommit().catch(() => undefined)
    const storedDigest = await getItem(PIN_KEY).catch(() => null)
    if (storedDigest !== material.digest) {
      await applyPendingPinRekey().catch(() => undefined)
      return false
    }
    setSessionPinDigest(material.digest)
  }
  await clearPinRekeyJournal().catch(() => undefined)
  return true
}

/** Returns null on first-time setup, where no PIN exists yet. */
async function getCurrentPinDigest(): Promise<string | null> {
  try {
    return await getPin()
  } catch {
    return null
  }
}

/**
 * Sets a new main PIN, re-encrypting every PIN-bound secret first.
 *
 * Unlock tests the duress PIN before the main PIN, so a main PIN equal to the
 * duress PIN would wipe the wallet on a normal unlock. The duress digest is
 * checked even while disabled, since re-enabling it keeps the stored digest.
 *
 * The unlock pad uses the main PIN length, so a duress PIN of the old length
 * could no longer be entered after a length change; it is cleared instead.
 */
async function changePin(
  newPin: string,
  reEncryptSecrets: (oldDigest: string, newDigest: string) => Promise<void>
): Promise<PinChangeResult> {
  const duressDigest = await getItem(DURESS_PIN_KEY)
  if (duressDigest && (await pinMatchesDuressDigest(newPin, duressDigest))) {
    return 'matchesDuress'
  }

  const currentDigest = await getCurrentPinDigest()
  const currentLength = await getStoredPinLength()
  const material = await preparePinMaterial(newPin)
  if (currentDigest && currentDigest !== material.digest) {
    try {
      await reEncryptSecrets(currentDigest, material.digest)
    } catch {
      return 'reEncryptFailed'
    }
  }
  const committed = await commitOrRollBack(material)
  if (!committed) {
    return 'reEncryptFailed'
  }

  // A missing length belongs to an older install. Clearing duress here would
  // drop it on an equal-length change, because the stored length is unknown.
  if (
    !duressDigest ||
    currentLength === null ||
    material.length === currentLength
  ) {
    return 'changed'
  }
  try {
    await useAuthStore.getState().clearDuressPin()
  } catch {
    return 'duressClearFailed'
  }
  return 'duressCleared'
}

/**
 * changePin for a screen: a throw anywhere in the change leaves the stored
 * PIN as it was (the re-key journal undoes any secret that already moved), so
 * it reports a failed change instead of leaving the caller waiting.
 */
async function changePinOrFail(
  newPin: string,
  reEncryptSecrets: (oldDigest: string, newDigest: string) => Promise<void>
): Promise<PinChangeResult> {
  try {
    return await changePin(newPin, reEncryptSecrets)
  } catch {
    return 'reEncryptFailed'
  }
}

export { changePin, changePinOrFail }
