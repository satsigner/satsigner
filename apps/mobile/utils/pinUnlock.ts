import { getKeySecret } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { type EncryptedKeySecret } from '@/types/models/Account'
import { recoverWorkingPinDigest } from '@/utils/pinKdf'
import { setSessionPinDigest } from '@/utils/pinSession'

async function getFirstEncryptedKeyProbe(): Promise<EncryptedKeySecret | null> {
  const { accounts } = useAccountsStore.getState()
  for (const account of accounts) {
    const storedKeys = await Promise.all(
      account.keys.map((_, index) => getKeySecret(account.id, index))
    )
    const probe = storedKeys.find((stored) => stored?.secret)
    if (probe?.secret) {
      return probe
    }
  }
  return null
}

/** Freeze the AES key for this unlocked session, recovering a crashed KDF upgrade. */
async function bindSessionPinDigest(
  pin: string,
  salt: string,
  storedDigest: string
): Promise<void> {
  const probe = await getFirstEncryptedKeyProbe()
  const digest = await recoverWorkingPinDigest(pin, salt, storedDigest, probe)
  setSessionPinDigest(digest)
}

async function finalizePinAuthSuccess(
  pin: string,
  salt: string,
  storedDigest: string,
  onSuccess: () => void | Promise<void>
): Promise<void> {
  await bindSessionPinDigest(pin, salt, storedDigest)
  await onSuccess()
}

export { finalizePinAuthSuccess, getFirstEncryptedKeyProbe }
