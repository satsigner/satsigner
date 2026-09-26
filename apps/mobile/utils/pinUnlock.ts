import { getKeySecret } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { type EncryptedKeySecret } from '@/types/models/Account'
import { migratePinKdfIfNeeded, recoverWorkingPinDigest } from '@/utils/pinKdf'
import { setSessionPinDigest } from '@/utils/pinSession'
import { reEncryptPinBoundSecrets } from '@/utils/reEncryptPinSecrets'

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

/**
 * Upgrade the stored digest to the current best KDF (re-encrypting every
 * PIN-bound secret) when it predates it. A migration failure must not lock the
 * user out of this session: it stays verified under the old config and retries
 * on the next unlock. Returns the upgraded digest, or null when none ran.
 */
async function migrateStoredPinKdf(
  pin: string,
  salt: string,
  storedDigest: string
): Promise<string | null> {
  const { accounts } = useAccountsStore.getState()
  try {
    return await migratePinKdfIfNeeded(
      pin,
      salt,
      storedDigest,
      (oldDigest, newDigest) =>
        reEncryptPinBoundSecrets(oldDigest, newDigest, accounts)
    )
  } catch {
    return null
  }
}

async function finalizePinAuthSuccess(
  pin: string,
  salt: string,
  storedDigest: string,
  onSuccess: () => void | Promise<void>
): Promise<void> {
  const upgradedDigest = await migrateStoredPinKdf(pin, salt, storedDigest)
  await bindSessionPinDigest(pin, salt, upgradedDigest ?? storedDigest)
  await onSuccess()
}

export { finalizePinAuthSuccess, getFirstEncryptedKeyProbe }
