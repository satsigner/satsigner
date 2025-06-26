import { type Network } from 'bdk-rn/lib/lib/enums'
import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { useAccountsStore } from '@/store/accounts'
import { useWalletsStore } from '@/store/wallets'
import { type Account } from '@/types/models/Account'

const useGetAccountWallet = (id: Account['id']) => {
  const [wallet, addAccountWallet] = useWalletsStore(
    useShallow((state) => [state.wallets[id], state.addAccountWallet])
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
    const walletData = await getWalletData(account, account.network as Network)
    if (!walletData) return
    addAccountWallet(id, walletData.wallet)
  }

  useEffect(() => {
    if (!wallet) addWallet()
  }, [id, account]) // eslint-disable-line react-hooks/exhaustive-deps

  return wallet
}

export default useGetAccountWallet
