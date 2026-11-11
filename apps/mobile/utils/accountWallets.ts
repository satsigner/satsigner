import { toast } from 'sonner-native'

import { getWalletData } from '@/api/bdk'
import { useAccountsStore } from '@/store/accounts'
import { useWalletsStore } from '@/store/wallets'
import type { Account, Key } from '@/types/models/Account'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { decryptAccountKeySecrets } from '@/utils/decryption'
import { parseAddressDescriptorToAddress } from '@/utils/parse'
import { yieldToUi } from '@/utils/time'

/**
 * Loads the wallet, or the watched address, of every account that has none
 * loaded. Reads the wallets store as it goes: a backup restore just replaced
 * it, keeping the same account ids.
 */
async function loadAccountWallets() {
  for (const account of useAccountsStore.getState().accounts) {
    try {
      const { wallets, addresses, addAccountWallet, addAccountAddress } =
        useWalletsStore.getState()
      const isImportAddress = account.keys[0].creationType === 'importAddress'
      const existsWallet = !isImportAddress
        ? !!wallets[account.id]
        : !!addresses[account.id]
      if (existsWallet) {
        continue
      }

      const secrets = await decryptAccountKeySecrets(account)
      const tmpAccount: Account = {
        ...account,
        keys: account.keys.map((key, index) => {
          const decryptedKey: Key = { ...key, secret: secrets[index] }
          return decryptedKey
        })
      }

      const walletData = !isImportAddress
        ? await getWalletData(
            tmpAccount,
            appNetworkToBdkNetwork(account.network)
          )
        : undefined
      if (walletData) {
        addAccountWallet(account.id, walletData.wallet, walletData.dbPath)
      }

      const importSecret = tmpAccount.keys[0].secret
      if (isImportAddress && typeof importSecret === 'object') {
        const descriptor = importSecret.externalDescriptor
        if (descriptor) {
          addAccountAddress(
            account.id,
            parseAddressDescriptorToAddress(descriptor)
          )
        }
      }
    } catch (error) {
      const label = account.name ?? account.id
      const reason = error instanceof Error ? error.message : String(error)
      toast.error(`${label}: ${reason}`)
    }
    await yieldToUi()
  }
}

export { loadAccountWallets }
