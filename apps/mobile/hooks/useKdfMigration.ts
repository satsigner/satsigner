import { getKeySecret, storeKeySecret } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { aesDecrypt, aesEncrypt, randomIv } from '@/utils/crypto'
import { migratePinKdfIfNeeded } from '@/utils/pinKdf'

/**
 * Re-encrypts every account key secret from one PIN digest to another,
 * in two phases: all secrets are decrypted (in memory) before any write
 * happens, so a decryption failure cannot leave secrets stranded between
 * two keys. Only the subsequent write phase can produce a mixed state
 * (pre-existing limitation of per-key SecureStore writes).
 */
export default function useKdfMigration() {
  const accounts = useAccountsStore((state) => state.accounts)

  async function reEncryptAllSecrets(oldDigest: string, newDigest: string) {
    const decrypted: {
      accountId: string
      keyIndex: number
      plaintext: string
    }[] = []

    for (const account of accounts) {
      for (let keyIndex = 0; keyIndex < account.keys.length; keyIndex += 1) {
        const stored = await getKeySecret(account.id, keyIndex)
        if (!stored) {
          continue
        }
        const plaintext = await aesDecrypt(stored.secret, oldDigest, stored.iv)
        decrypted.push({ accountId: account.id, keyIndex, plaintext })
      }
    }

    for (const item of decrypted) {
      const newIv = randomIv()
      const newSecret = await aesEncrypt(item.plaintext, newDigest, newIv)
      await storeKeySecret(item.accountId, item.keyIndex, newSecret, newIv)
    }
  }

  function migrateIfNeeded(
    pin: string,
    salt: string,
    storedDigest: string
  ): Promise<string | null> {
    return migratePinKdfIfNeeded(pin, salt, storedDigest, reEncryptAllSecrets)
  }

  return migrateIfNeeded
}
