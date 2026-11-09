import { SALT_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
import { useAuthStore } from '@/store/auth'
import { getPin } from '@/utils/pin'
import {
  derivePinDigest,
  getStoredKdfConfig,
  safeEqualHex
} from '@/utils/pinKdf'

type DuressPinSetResult = 'set' | 'mainPinMissing' | 'matchesMainPin' | 'failed'

async function trySetDuressPin(pin: string): Promise<DuressPinSetResult> {
  const salt = await getItem(SALT_KEY)
  const mainDigest = await getPin()
  if (!salt || !mainDigest) {
    return 'mainPinMissing'
  }
  // Equality is checked under the main PIN's own KDF config, which may
  // differ from the config a fresh duress PIN will be stored with.
  const mainKdf = await getStoredKdfConfig()
  const candidate = await derivePinDigest(pin, salt, mainKdf)
  if (safeEqualHex(mainDigest, candidate)) {
    return 'matchesMainPin'
  }
  await useAuthStore.getState().setDuressPin(pin)
  return 'set'
}

/** Arms a duress PIN; a failure anywhere reports `failed` instead of throwing. */
async function setDuressPinSafely(pin: string): Promise<DuressPinSetResult> {
  try {
    return await trySetDuressPin(pin)
  } catch {
    return 'failed'
  }
}

export { type DuressPinSetResult, setDuressPinSafely }
