import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useWalletsStore } from '@/store/wallets'
import { type Account, type Secret } from '@/types/models/Account'
import { aesDecrypt } from '@/utils/crypto'

const useGetAccountAddress = (id: Account['id']) => {
  const [address, addAccountAddress] = useWalletsStore(
    useShallow((state) => [state.addresses[id], state.addAccountAddress])
  )

  const account = useAccountsStore((state) =>
    state.accounts.find((a) => a.id === id)
  )

  const network = useBlockchainStore((state) => state.selectedNetwork)

  async function addAddress() {
    try {
      if (!account || account.keys.length === 0) return

      // Create a temporary account with decrypted secrets
      const temporaryAccount = JSON.parse(JSON.stringify(account)) as Account
      const pin = await getItem(PIN_KEY)
      if (!pin) return

      for (const key of temporaryAccount.keys) {
        if (typeof key.secret === 'string') {
          const decryptedSecretString = await aesDecrypt(
            key.secret,
            pin,
            key.iv
          )
          const decryptedSecret = JSON.parse(decryptedSecretString) as Secret
          key.secret = decryptedSecret
        }
      }

      // Handle import address case
      if (account.keys[0].creationType === 'importAddress') {
        const secret = temporaryAccount.keys[0].secret as Secret
        if (secret.externalDescriptor) {
          // Try to extract address from descriptor
          // It could be in format addr(address) or just a plain address
          let address: string
          if (
            secret.externalDescriptor.startsWith('addr(') &&
            secret.externalDescriptor.endsWith(')')
          ) {
            // Extract address from addr(address) format
            address = secret.externalDescriptor.slice(5, -1)
          } else {
            // Assume it's a plain address
            address = secret.externalDescriptor
          }
          addAccountAddress(account.id, address)
          return
        }
      }

      // For all other account types, use BDK to generate wallet and get first address
      const walletData = await getWalletData(
        temporaryAccount,
        network as any // Cast to BDK Network type
      )

      if (!walletData) {
        return
      }

      // Get the first address from the wallet
      const addressInfo = await walletData.wallet.getAddress(0)
      const address = addressInfo?.address
      const firstAddress = address ? await address.asString() : ''

      addAccountAddress(account.id, firstAddress)
    } catch (_error) {
      // Silently handle errors
    }
  }

  useEffect(() => {
    if (!address) {
      addAddress().catch(() => {
        // Silently handle errors
      })
    }
  }, [address, id, account]) // eslint-disable-line react-hooks/exhaustive-deps

  return address
}

export default useGetAccountAddress
