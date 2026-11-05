import { getWalletData } from '@/api/bdk'
import { t } from '@/locales'
import { useWalletsStore } from '@/store/wallets'
import { type Account } from '@/types/models/Account'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { getAccountWithDecryptedKeys } from '@/utils/decryption'
import { findFirstUnusedExternalAddress } from '@/utils/derivedAddress'

async function loadAccountWallet(account: Account) {
  const loaded = useWalletsStore.getState().wallets[account.id]
  if (loaded) {
    return loaded
  }
  const decrypted = await getAccountWithDecryptedKeys(account)
  const walletData = await getWalletData(
    decrypted,
    appNetworkToBdkNetwork(account.network)
  )
  return walletData?.wallet
}

function collectUsedAddresses(account: Account): Set<string> {
  return new Set(
    account.transactions.flatMap((transaction) =>
      transaction.vout.flatMap((output) =>
        output.address ? [output.address] : []
      )
    )
  )
}

/**
 * First external address of the account that no known transaction pays,
 * derived from the account's own descriptor rather than read from storage.
 */
export async function deriveFreshReceiveAddress(
  account: Account
): Promise<string> {
  const wallet = await loadAccountWallet(account)
  const addressInfo = wallet
    ? findFirstUnusedExternalAddress(wallet, collectUsedAddresses(account))
    : undefined
  if (!addressInfo) {
    throw new Error(t('account.error.noFreshAddress'))
  }
  return addressInfo.address
}
