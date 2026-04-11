import { useEffect } from 'react'
import { KeychainKind } from 'react-native-bdk-sdk'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useWalletsStore } from '@/store/wallets'
import { type Account } from '@/types/models/Account'
import { getAccountWithDecryptedKeys } from '@/utils/account'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'

const useGetAccountAddress = (id: Account['id']) => {
  const [address, addAccountAddress] = useWalletsStore(
    useShallow((state) => [state.addresses[id], state.addAccountAddress])
  )

  const account = useAccountsStore((state) =>
    state.accounts.find((a) => a.id === id)
  )

  const network = useBlockchainStore((state) => state.selectedNetwork)

  async function addAddress() {
    if (!account || account.keys.length === 0) {
      return
    }

    try {
      const temporaryAccount = await getAccountWithDecryptedKeys(account)

      if (account.keys[0].creationType === 'importAddress') {
        const [{ secret }] = temporaryAccount.keys
        if (!secret.externalDescriptor) {
          return
        }

        // Try to extract address from descriptor
        // It could be in format addr(address) or just a plain address
        const address =
          secret.externalDescriptor.startsWith('addr(') &&
          secret.externalDescriptor.endsWith(')')
            ? secret.externalDescriptor.slice(5, -1)
            : secret.externalDescriptor
        addAccountAddress(account.id, address)
        return
      }

      // For all other account types, use BDK to generate wallet and get first address
      const walletData = await getWalletData(
        temporaryAccount,
        appNetworkToBdkNetwork(network)
      )

      if (!walletData) {
        return
      }

      // Get the first address from the wallet
      const addressInfo = walletData.wallet.peekAddress(
        KeychainKind.External,
        0
      )
      const firstAddress = addressInfo?.address ?? ''
      addAccountAddress(account.id, firstAddress)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown reason'
      throw new Error(`Failed to get account address: ${reason}`, {
        cause: error
      })
    }
  }

  useEffect(() => {
    if (!address) {
      addAddress()
    }
  }, [address, id, account]) // eslint-disable-line react-hooks/exhaustive-deps

  return address
}

export default useGetAccountAddress
