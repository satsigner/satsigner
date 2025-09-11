import { type Network } from 'bdk-rn/lib/lib/enums'
import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useWalletsStore } from '@/store/wallets'
import { type Account, type Secret } from '@/types/models/Account'
import { aesDecrypt } from '@/utils/crypto'

const useGetAccountWallet = (id: Account['id']) => {
  const [wallet, addAccountWallet] = useWalletsStore(
    useShallow((state) => [
      state.wallets[id],
      state.addAccountWallet,
      state.removeAccountWallet
    ])
  )

  const account = useAccountsStore((state) =>
    state.accounts.find((a) => a.id === id)
  )

  async function addWallet() {
    if (
      !account ||
      account.keys.length === 0 ||
      account.keys[0].creationType === 'importAddress'
    ) {
      return
    }

    try {
      // Create a copy of the account to avoid mutating the original
      const temporaryAccount = JSON.parse(JSON.stringify(account)) as Account

      // Get PIN for decryption (might be null if no PIN is set)
      const pin = await getItem(PIN_KEY)

      // Decrypt secrets if they are encrypted strings
      for (const key of temporaryAccount.keys) {
        if (typeof key.secret === 'string' && pin) {
          try {
            const decryptedSecretString = await aesDecrypt(
              key.secret,
              pin,
              key.iv
            )
            const decryptedSecret = JSON.parse(decryptedSecretString) as Secret
            key.secret = decryptedSecret
          } catch (_error) {
            return // Cannot proceed without decrypted secrets
          }
        } else if (typeof key.secret === 'string' && !pin) {
          return // Cannot proceed without decrypted secrets
        }
      }

      const walletData = await getWalletData(
        temporaryAccount,
        account.network as Network
      )

      if (!walletData) return

      addAccountWallet(id, walletData.wallet)
    } catch (_error) {
      // Handle error silently
    }
  }

  useEffect(() => {
    if (!wallet) {
      addWallet()
    }
  }, [id, account]) // eslint-disable-line react-hooks/exhaustive-deps

  return wallet
}

export default useGetAccountWallet
