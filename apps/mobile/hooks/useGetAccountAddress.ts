import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useWalletsStore } from '@/store/wallets'
import { type Account } from '@/types/models/Account'
import { getAccountWithDecryptedKeys } from '@/utils/account'

const useGetAccountAddress = (id: Account['id']) => {
  const [address, addAccountAddress] = useWalletsStore(
    useShallow((state) => [state.addresses[id], state.addAccountAddress])
  )

  const account = useAccountsStore((state) =>
    state.accounts.find((a) => a.id === id)
  )

  const network = useBlockchainStore((state) => state.selectedNetwork)

  async function addAddress() {
    if (!account || account.keys.length === 0) return

    try {
      const temporaryAccount = await getAccountWithDecryptedKeys(account)

      if (account.keys[0].creationType === 'importAddress') {
        const secret = temporaryAccount.keys[0].secret
        if (!secret.externalDescriptor) return

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
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown reason'
      throw new Error(`Failed to get account address: ${reason}`)
    }
  }

  useEffect(() => {
    if (!address) addAddress()
  }, [address, id, account]) // eslint-disable-line react-hooks/exhaustive-deps

  return address
}

export default useGetAccountAddress
