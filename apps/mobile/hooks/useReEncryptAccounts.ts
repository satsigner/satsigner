import { getKeySecret, storeKeySecret } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { aesDecrypt, aesEncrypt, randomIv } from '@/utils/crypto'

export default function useReEncryptAccounts() {
  const accounts = useAccountsStore((state) => state.accounts)

  async function reEncryptAccounts(
    oldPinEncrypted: string,
    newPinEncrypted: string
  ) {
    for (const account of accounts) {
      for (let k = 0; k < account.keys.length; k += 1) {
        const stored = await getKeySecret(account.id, k)
        if (!stored) {
          continue
        }

        const decryptedString = await aesDecrypt(
          stored.secret,
          oldPinEncrypted,
          stored.iv
        )
        const newIv = randomIv()
        const newSecret = await aesEncrypt(
          decryptedString,
          newPinEncrypted,
          newIv
        )

        await storeKeySecret(account.id, k, newSecret, newIv)
      }
    }
  }

  return reEncryptAccounts
}
