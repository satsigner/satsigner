import { useShallow } from 'zustand/react/shallow'

import { DURESS_PIN_KEY, SALT_KEY_DURESS } from '@/config/auth'
import { deleteArkDatadir } from '@/storage/arkDatadir'
import {
  deleteAllKeySecrets,
  deleteArkMnemonic,
  deleteEcashMnemonic,
  deleteItem
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

/**
 * Best-effort wipe of wallet secrets and local account state for duress PIN.
 * Clears SecureStore mnemonics/keys, MMKV identity/LND config, and in-memory stores.
 */
export function useSecureWipe() {
  const [accounts, deleteAccounts, deleteTags] = useAccountsStore(
    useShallow((state) => [
      state.accounts,
      state.deleteAccounts,
      state.deleteTags
    ])
  )
  const [ecashAccounts, clearEcashData] = useEcashStore(
    useShallow((state) => [state.accounts, state.clearAllData])
  )
  const [arkAccounts, clearArkData] = useArkStore(
    useShallow((state) => [state.accounts, state.clearAllData])
  )
  const deleteWallets = useWalletsStore((state) => state.deleteWallets)
  const clearTransactionBuilderData = useTransactionBuilderStore(
    (state) => state.clearAllData
  )
  const clearNostrIdentity = useNostrIdentityStore((state) => state.clearAll)
  const clearNostrState = useNostrStore((state) => state.clearAllNostrState)
  const clearLightningConfig = useLightningStore((state) => state.clearConfig)
  const stripAllRpcCredentials = useBlockchainStore(
    (state) => state.stripAllRpcCredentials
  )
  const [setDuressPinEnabled, setSkipPin] = useAuthStore(
    useShallow((state) => [state.setDuressPinEnabled, state.setSkipPin])
  )

  return async function secureWipe(): Promise<void> {
    await Promise.all(
      accounts.map((account) =>
        deleteAllKeySecrets(account.id, account.keys.length).catch(
          () => undefined
        )
      )
    )

    await Promise.all(
      ecashAccounts.map((account) =>
        deleteEcashMnemonic(account.id).catch(() => undefined)
      )
    )

    await Promise.all(
      arkAccounts.map(async (account) => {
        await deleteArkMnemonic(account.id).catch(() => undefined)
        await deleteArkDatadir(account.id).catch(() => undefined)
      })
    )

    deleteAccounts()
    deleteTags()
    deleteWallets()
    clearEcashData()
    clearArkData()
    clearTransactionBuilderData()
    clearNostrIdentity()
    clearNostrState()
    clearLightningConfig()
    clearNostrFollowCaches()

    stripAllRpcCredentials()

    setDuressPinEnabled(false)
    setSkipPin(false)

    await deleteItem(DURESS_PIN_KEY)
    await deleteItem(SALT_KEY_DURESS)
  }
}
