import { useEffect } from 'react'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { useAccountsStore } from '@/store/accounts'
import { useWalletsStore } from '@/store/wallets'
import { type Account } from '@/types/models/Account'
import { getAccountWithDecryptedKeys } from '@/utils/account'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'

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
      const tmpAccount = await getAccountWithDecryptedKeys(account)
      const walletData = await getWalletData(
        tmpAccount,
        appNetworkToBdkNetwork(account.network)
      )

      if (!walletData) {
        return
      }

      addAccountWallet(id, walletData.wallet)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown reason'
      toast.error(`Failed to load wallet: ${reason}`)
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
