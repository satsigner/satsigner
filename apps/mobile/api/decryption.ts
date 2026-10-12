import { type Account } from '@/types/models/Account'
import { decryptAccountKeySecret } from '@/utils/decryption'

/**
 * Decrypts every key secret of the account. A key that fails to decrypt is
 * returned unchanged, so signing can still use the keys that did.
 */
function decryptAccountKeysOrFallback(account: Pick<Account, 'id' | 'keys'>) {
  return Promise.all(
    account.keys.map(async (key, index) => {
      try {
        const secret = await decryptAccountKeySecret(account.id, index)
        return { ...key, secret }
      } catch {
        return key
      }
    })
  )
}

export { decryptAccountKeysOrFallback }
