import { DURESS_KDF_KEY, DURESS_PIN_KEY, SALT_KEY_DURESS } from '@/config/auth'
import { LAST_ROUTE_STORAGE_KEY } from '@/constants/navigation'
import { deleteChatMessagesForIdentity } from '@/db/mutations/nostrChat'
import { clearAllCache } from '@/db/nostrCache'
import { clearNostrProcessedEvents } from '@/db/nostrProcessedEvents'
import { teardownAllNip46Sessions } from '@/services/nip46Sessions'
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
import { useArkExitClaimsStore } from '@/store/arkExitClaims'
import { useArkSwapsStore } from '@/store/arkSwaps'
import { useAuthStore } from '@/store/auth'
import { useBlockchainStore } from '@/store/blockchain'
import { useEcashStore } from '@/store/ecash'
import { useEcashAccountBuilderStore } from '@/store/ecashAccountBuilder'
import { useLightningStore } from '@/store/lightning'
import { useNostrStore } from '@/store/nostr'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useNostrIdentityDraftStore } from '@/store/nostrIdentityDraft'
import { useNostrVideoStore } from '@/store/nostrVideo'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { useWalletsStore } from '@/store/wallets'
import { wipeDevConsoleLog } from '@/utils/devConsole'
import { closeActiveChatPipeline } from '@/utils/nostrChat'
import { stopNostrLifecycle } from '@/utils/nostrLifecycle'
import { deleteAllNostrSecretsForWipe } from '@/utils/nostrSecrets'
import { nostrSyncService } from '@/utils/nostrSyncService'
import {
  deleteAllRpcCredentialsSafe,
  deleteLndSecretsSafe
} from '@/utils/serviceSecrets'
import { teardownUnlockedSessionSafe } from '@/utils/sessionTeardown'

/** Nostr data kept in SQLite outside the account rows: event cache, dedupe. */
function wipeNostrSqliteData(): void {
  for (const wipe of [clearAllCache, clearNostrProcessedEvents]) {
    try {
      wipe()
    } catch {
      /* best-effort: continue wiping remaining data */
    }
  }
}

/**
 * Best-effort wipe of wallet secrets and local account state for duress PIN.
 * Clears SecureStore mnemonics/keys/nostr/LND/RPC, MMKV identity/LND config,
 * and in-memory stores.
 */
export async function secureWipeAllWalletData(): Promise<void> {
  const { accounts } = useAccountsStore.getState()
  const { identities } = useNostrIdentityStore.getState()

  stopNostrLifecycle()
  // Ark daemons must stop before their datadirs are deleted below.
  await teardownUnlockedSessionSafe()
  teardownAllNip46Sessions()
  closeActiveChatPipeline()
  useNostrVideoStore.getState().releaseAllVideos()
  await nostrSyncService.stopAll().catch(() => undefined)

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
  await deleteAccounts()
  deleteTags()
  useWalletsStore.getState().deleteWallets()
  useEcashStore.getState().clearAllData()
  useEcashAccountBuilderStore.getState().clearAccount()
  useArkStore.getState().clearAllData()
  useArkSwapsStore.getState().clearAllData()
  useArkExitClaimsStore.getState().clearAllData()
  useTransactionBuilderStore.getState().clearAllData()
  await useNostrIdentityStore.getState().clearAll()
  useNostrIdentityDraftStore.getState().clearDraft()
  useNostrStore.getState().clearAllNostrState()
  wipeNostrSqliteData()
  useLightningStore.getState().clearConfig()
  clearNostrFollowCaches()
  try {
    wipeDevConsoleLog()
  } catch {
    /* best-effort: continue wiping remaining data */
  }

  useBlockchainStore.getState().stripAllRpcCredentials()

  // A backup restore waiting for the next unlock would put the wiped wallets
  // back, and the page history, the last route and the restored server
  // warning are a trail of what was there.
  const {
    clearDuressPin,
    clearPageHistory,
    setPendingRecoverData,
    setRestoredPublicServerName,
    setSkipPin
  } = useAuthStore.getState()
  setPendingRecoverData(null)
  setRestoredPublicServerName(null)
  clearPageHistory()
  await deleteItem(LAST_ROUTE_STORAGE_KEY).catch(() => undefined)
  setSkipPin(false)
  await clearDuressPin().catch(() => undefined)
}

/**
 * Wipe after the last wrong PIN, back to a fresh install. Unlike the duress
 * wipe, the main PIN material goes too: setting the next PIN would otherwise
 * re-encrypt any secret that survived to the new owner's PIN.
 *
 * Returns false when that PIN material is still stored. The app stays locked
 * so the next PIN setup cannot re-encrypt leftovers.
 */
export async function secureWipeAfterMaxPinTries(): Promise<boolean> {
  try {
    await secureWipeAllWalletData()
  } catch {
    return false
  }

  const {
    clearPin,
    resetPinTries,
    setFirstTime,
    setLockTriggered,
    setRequiresAuth
  } = useAuthStore.getState()
  try {
    await clearPin()
  } catch {
    return false
  }
  setFirstTime(true)
  setRequiresAuth(false)
  setLockTriggered(false)
  resetPinTries()
  return true
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
