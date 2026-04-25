import { useShallow } from 'zustand/react/shallow'

import { useAccountsStore } from '@/store/accounts'
import type { Account } from '@/types/models/Account'
import type { Network } from '@/types/settings/blockchain'

/**
 * Returns singlesig on-chain Bitcoin accounts with a recoverable mnemonic
 * on the given network — the only accounts that can back an Ark wallet.
 */
export function useArkBitcoinAccounts(network: Network): Account[] {
  const accounts = useAccountsStore(useShallow((state) => state.accounts))
  return accounts.filter((account) => {
    if (account.network !== network) {
      return false
    }
    if (account.policyType !== 'singlesig') {
      return false
    }
    const [firstKey] = account.keys
    if (!firstKey) {
      return false
    }
    return (
      firstKey.creationType === 'generateMnemonic' ||
      firstKey.creationType === 'importMnemonic'
    )
  })
}
