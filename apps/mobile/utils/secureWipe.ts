import { DURESS_KDF_KEY, DURESS_PIN_KEY, SALT_KEY_DURESS } from '@/config/auth'
import { deleteChatMessagesForIdentity } from '@/db/mutations/nostrChat'
import { deleteArkDatadir } from '@/storage/arkDatadir'
import {
  deleteAllKeySecrets,
  deleteArkMnemonic,
  deleteEcashMnemonic,
  deleteItem,
  getItem
} from '@/storage/encrypted'
import { clearNostrFollowCaches } from '@/storage/mmkv'
import { useAccountsStore } from '@/store/accounts'
import { useArkStore } from '@/store/ark'
import { useAuthStore } from '@/store/auth'
import { useBlockchainStore } from '@/store/blockchain'
import { useEcashStore } from '@/store/ecash'
import { useLightningStore } from '@/store/lightning'
import { useNostrStore } from '@/store/nostr'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { useWalletsStore } from '@/store/wallets'
import { deleteAllNostrSecretsForWipe } from '@/utils/nostrSecrets'
import {
  deleteAllRpcCredentialsSafe,
  deleteLndSecretsSafe
} from '@/utils/serviceSecrets'

/**
 * Best-effort wipe of wallet secrets and local account state for duress PIN.
 * Clears SecureStore mnemonics/keys/nostr/LND/RPC, MMKV identity/LND config,
 * and in-memory stores.
 */
export async function secureWipeAllWalletData(): Promise<void> {
  const { accounts } = useAccountsStore.getState()
  const { identities } = useNostrIdentityStore.getState()

  await Promise.all(
    accounts.map((account) =>
      deleteAllKeySecrets(account.id, account.keys.length).catch(
        () => undefined
      )
    )
  )

  await deleteAllNostrSecretsForWipe(
    identities.map((identity) => identity.npub),
    accounts.map((account) => account.id)
  ).catch(() => undefined)

  for (const identity of identities) {
    try {
      deleteChatMessagesForIdentity(identity.npub)
    } catch {
      /* best-effort: continue wiping remaining data */
    }
  }

  await deleteLndSecretsSafe()
  await deleteAllRpcCredentialsSafe()

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
  useTransactionBuilderStore.getState().clearAllData()
  useNostrIdentityStore.getState().clearAll()
  useNostrStore.getState().clearAllNostrState()
  useLightningStore.getState().clearConfig()
  clearNostrFollowCaches()

  useBlockchainStore.getState().stripAllRpcCredentials()

  const { setDuressPinEnabled, setSkipPin } = useAuthStore.getState()
  setDuressPinEnabled(false)
  setSkipPin(false)

  await deleteItem(DURESS_PIN_KEY).catch(() => undefined)
  await deleteItem(DURESS_KDF_KEY).catch(() => undefined)
  await deleteItem(SALT_KEY_DURESS).catch(() => undefined)
}

/** True once the duress PIN, its KDF, and its salt are gone from storage. */
export async function isDuressPinRemoved(): Promise<boolean> {
  const [pin, kdf, salt] = await Promise.all([
    getItem(DURESS_PIN_KEY),
    getItem(DURESS_KDF_KEY),
    getItem(SALT_KEY_DURESS)
  ])
  return !pin && !kdf && !salt
}

/**
 * Resets the app to a fresh install after the last wrong PIN. The secrets go
 * too, so whoever sets the next PIN cannot reach Ark, ecash or Nostr funds.
 */
export async function secureWipeAfterMaxPinTries(): Promise<void> {
  await secureWipeAllWalletData().catch(() => undefined)

  const { deleteAccounts, deleteTags } = useAccountsStore.getState()
  deleteAccounts()
  useWalletsStore.getState().deleteWallets()
  deleteTags()

  const { resetPinTries, setFirstTime, setLockTriggered, setRequiresAuth } =
    useAuthStore.getState()
  setFirstTime(true)
  setRequiresAuth(false)
  setLockTriggered(false)
  resetPinTries()
}
