import { DURESS_PIN_KEY } from '@/config/auth'
import { deleteArkDatadir } from '@/storage/arkDatadir'
import {
  deleteAllKeySecrets,
  deleteArkMnemonic,
  deleteEcashMnemonic,
  deleteItem
} from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useArkStore } from '@/store/ark'
import { useAuthStore } from '@/store/auth'
import { useBlockchainStore } from '@/store/blockchain'
import { useEcashStore } from '@/store/ecash'
import { useLightningStore } from '@/store/lightning'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useWalletsStore } from '@/store/wallets'
import { type Network } from '@/types/settings/blockchain'

const BLOCKCHAIN_NETWORKS: Network[] = ['bitcoin', 'testnet', 'signet']

/**
 * Best-effort wipe of wallet secrets and local account state for duress PIN.
 * Clears SecureStore mnemonics/keys, MMKV identity/LND config, and in-memory stores.
 */
export async function secureWipeAllWalletData(): Promise<void> {
  const { accounts } = useAccountsStore.getState()
  await Promise.all(
    accounts.map((account) =>
      deleteAllKeySecrets(account.id, account.keys.length)
    )
  )

  const { accounts: ecashAccounts } = useEcashStore.getState()
  await Promise.all(
    ecashAccounts.map((account) =>
      deleteEcashMnemonic(account.id).catch(() => undefined)
    )
  )

  const { accounts: arkAccounts } = useArkStore.getState()
  await Promise.all(
    arkAccounts.map(async (account) => {
      await deleteArkMnemonic(account.id).catch(() => undefined)
      await deleteArkDatadir(account.id).catch(() => undefined)
    })
  )

  const { deleteAccounts, deleteTags } = useAccountsStore.getState()
  deleteAccounts()
  deleteTags()
  useWalletsStore.getState().deleteWallets()
  useEcashStore.getState().clearAllData()
  useArkStore.getState().clearAllData()
  useNostrIdentityStore.getState().clearAll()
  useLightningStore.getState().clearConfig()

  const { configs, updateServer } = useBlockchainStore.getState()
  for (const network of BLOCKCHAIN_NETWORKS) {
    const { server } = configs[network]
    if (!server.rpcCredentials) {
      continue
    }
    const { rpcCredentials: _removed, ...rest } = server
    updateServer(network, rest)
  }

  const { setDuressPinEnabled, setSkipPin } = useAuthStore.getState()
  setDuressPinEnabled(false)
  setSkipPin(false)

  await deleteItem(DURESS_PIN_KEY).catch(() => undefined)
}
