import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { useAccountsStore } from '@/store/accounts'
import { useWalletsStore } from '@/store/wallets'
import { type Account } from '@/types/models/Account'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { getAccountWithDecryptedKeys } from '@/utils/decryption'

function canLoadAccountWallet(
  account: Account | undefined
): account is Account {
  return (
    account !== undefined &&
    account.keys.length > 0 &&
    account.keys[0].creationType !== 'importAddress'
  )
}

/** Loads the wallet into the store; reports a failure once and never throws. */
async function loadAccountWallet(account: Account): Promise<boolean> {
  try {
    const decrypted = await getAccountWithDecryptedKeys(account)
    const walletData = await getWalletData(
      decrypted,
      appNetworkToBdkNetwork(account.network)
    )
    if (!walletData) {
      return false
    }
    useWalletsStore
      .getState()
      .addAccountWallet(account.id, walletData.wallet, walletData.dbPath)
    return true
  } catch (error) {
    const label = account.name ?? account.id
    const reason = error instanceof Error ? error.message : 'unknown reason'
    toast.error(`${label}: Failed to load wallet: ${reason}`)
    return false
  }
}

// Every screen of an account shares one load: several wallets opened on the
// same database would race each other. The key follows whether the wallet is
// loaded, so a wallet removed later (rescan) is loaded again.
const useGetAccountWallet = (id: Account['id']) => {
  const [wallet] = useWalletsStore(useShallow((state) => [state.wallets[id]]))

  const account = useAccountsStore((state) =>
    state.accounts.find((a) => a.id === id)
  )

  useQuery({
    enabled: !wallet && canLoadAccountWallet(account),
    gcTime: 0,
    queryFn: () => (account ? loadAccountWallet(account) : false),
    queryKey: ['account-wallet', id, wallet ? 'loaded' : 'missing'],
    retry: false,
    staleTime: Infinity
  })

  return wallet
}

export default useGetAccountWallet
