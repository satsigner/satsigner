import { DURESS_PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
import { useAuthStore } from '@/store/auth'
import { getPin, getStoredPinLength } from '@/utils/pin'
import {
  commitPinMaterial,
  pinMatchesDuressDigest,
  preparePinMaterial
} from '@/utils/pinKdf'

type PinChangeResult =
  | 'changed'
  | 'duressCleared'
  | 'duressClearFailed'
  | 'matchesDuress'
  | 'reEncryptFailed'

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
  await commitPinMaterial(material)

  if (!duressDigest || material.length === currentLength) {
    return 'changed'
  }
  try {
    await useAuthStore.getState().clearDuressPin()
  } catch {
    return 'duressClearFailed'
  }
  return 'duressCleared'
}

export { changePin }
