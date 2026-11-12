import { type BdkWallet } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'

import { deleteWalletDb, getWalletData } from '@/api/bdk'
import { openServerChainReader } from '@/api/serverChain'
import {
  WALLET_CHAIN_CHECK_TIMEOUT_MS,
  WALLET_CHAIN_CHECK_TOR_TIMEOUT_MS
} from '@/constants/sync'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useWalletsStore } from '@/store/wallets'
import type { Account, Key } from '@/types/models/Account'
import { type Server } from '@/types/settings/blockchain'
import { clearAccountChainData } from '@/utils/account'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import {
  decryptAccountKeySecrets,
  getAccountWithDecryptedKeys
} from '@/utils/decryption'
import { parseAddressDescriptorToAddress } from '@/utils/parse'
import { isOnionUrl } from '@/utils/serverPrivacy'
import { withTimeout, yieldToUi } from '@/utils/time'
import { isWalletOnServerChain } from '@/utils/walletChain'

// The server each wallet was last found to share a chain with, in this
// session. Another server, or a wallet since replaced, is checked again. Weak,
// so a wallet dropped from the store can still be freed.
const serverCheckedForWallet = new WeakMap<BdkWallet, string>()

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

function serverCheckKey(server: Server) {
  return `${server.backend}|${server.url}`
}

async function readIsWalletOnServerChain(wallet: BdkWallet, server: Server) {
  const reader = await openServerChainReader(server)
  try {
    return await isWalletOnServerChain(wallet.checkpoints(), reader)
  } finally {
    reader.close()
  }
}

/** Swaps the account's wallet for an empty one on a new database. */
async function recreateAccountWallet(account: Account): Promise<BdkWallet> {
  const dbPath = useWalletsStore.getState().dbPaths[account.id]
  if (!dbPath) {
    throw new Error(t('account.sync.otherChainRescan'))
  }
  await deleteWalletDb(dbPath)
  const walletData = await getWalletData(
    await getAccountWithDecryptedKeys(account),
    appNetworkToBdkNetwork(account.network)
  )
  if (!walletData) {
    throw new Error(t('account.sync.otherChainRescan'))
  }
  useWalletsStore
    .getState()
    .addAccountWallet(account.id, walletData.wallet, walletData.dbPath)
  // If this full scan fails, the next sync must not read the other chain's
  // history as a reason to scan only the addresses it already knows.
  const { accounts, updateAccount } = useAccountsStore.getState()
  updateAccount(
    clearAccountChainData(
      accounts.find((entry) => entry.id === account.id) ?? account
    )
  )
  return walletData.wallet
}

/**
 * The wallet to sync the account with on this server: a new, empty one when
 * the account's wallet holds blocks of another chain, so the two chains'
 * histories don't mix. A check that fails keeps the wallet: the sync itself
 * then reports the server problem. A sync given up on during the check
 * leaves the wallet alone.
 */
async function walletForServerChain(
  account: Account,
  wallet: BdkWallet,
  server: Server,
  signal?: AbortSignal
): Promise<BdkWallet> {
  const serverKey = serverCheckKey(server)
  if (serverCheckedForWallet.get(wallet) === serverKey) {
    return wallet
  }
  const isOnServerChain = await withTimeout(
    readIsWalletOnServerChain(wallet, server),
    isOnionUrl(server.url)
      ? WALLET_CHAIN_CHECK_TOR_TIMEOUT_MS
      : WALLET_CHAIN_CHECK_TIMEOUT_MS
  ).catch(() => undefined)
  if (isOnServerChain === undefined || signal?.aborted) {
    return wallet
  }
  const syncWallet = isOnServerChain
    ? wallet
    : await recreateAccountWallet(account)
  serverCheckedForWallet.set(syncWallet, serverKey)
  return syncWallet
}

export { loadAccountWallets, walletForServerChain }
