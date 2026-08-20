import { getKeySecret, storeKeySecret } from '@/storage/encrypted'
import { type Account } from '@/types/models/Account'
import { aesDecrypt, aesEncrypt, randomIv } from '@/utils/crypto'
import { reEncryptNostrSecrets } from '@/utils/nostrSecrets'
import { reEncryptServiceSecrets } from '@/utils/serviceSecrets'

/**
 * Re-encrypts every PIN-bound secret (account keys, nostr nsecs, LND/RPC)
 * from one digest to another. Account keys are decrypted in memory before
 * any write, so a decryption failure cannot leave keys stranded between
 * two digests.
 */
export async function reEncryptPinBoundSecrets(
  oldDigest: string,
  newDigest: string,
  accounts: Account[]
): Promise<void> {
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

  await reEncryptNostrSecrets(oldDigest, newDigest)
  await reEncryptServiceSecrets(oldDigest, newDigest)
}
