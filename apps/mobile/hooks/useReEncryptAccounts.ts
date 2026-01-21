import { useShallow } from 'zustand/react/shallow'

import { useAccountsStore } from '@/store/accounts'
import { type Account, type Secret } from '@/types/models/Account'
import { aesDecrypt, aesEncrypt, randomIv } from '@/utils/crypto'

export default function useReEncryptAccounts() {
  const [accounts, updateAccount] = useAccountsStore(
    useShallow((state) => [state.accounts, state.updateAccount])
  )

  async function reEncryptAccounts(
    oldPinEncrypted: string,
    newPinEncrypted: string
  ) {
    const updatedAccounts: Account[] = []

    for (const account of accounts) {
      // make copy of objects and arrays to avoid directly mutation of store
      const updatedAccount = { ...account }
      updatedAccount.keys = [...account.keys]

      for (let k = 0; k < account.keys.length; k += 1) {
        const key = account.keys[k]

        // get the secret currently encrypted using old PIN
        let secret: Secret | undefined
        if (typeof key.secret === 'string') {
          const decryptedSecretString = await aesDecrypt(
            key.secret,
            oldPinEncrypted,
            key.iv
          )
          secret = JSON.parse(decryptedSecretString) as Secret
        } else {
          secret = key.secret
        }

        // encrypt secret with new pin
        const serializedSecret = JSON.stringify(secret)
        const newIv = randomIv()
        const newSecret = await aesEncrypt(
          serializedSecret,
          newPinEncrypted,
          newIv
        )

        // update secret while avoiding mutating nested objects in store
        updatedAccount.keys[k] = {
          ...account.keys[k],
          secret: newSecret,
          iv: newIv
        }
      }

      updatedAccounts.push(updatedAccount)
      // update storej
    }

    for (const account of updatedAccounts) {
      updateAccount(account)
    }
  }

  return reEncryptAccounts
}
