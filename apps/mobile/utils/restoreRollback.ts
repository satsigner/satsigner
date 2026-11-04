import {
  deleteArkMnemonic,
  deleteEcashMnemonic,
  getArkMnemonic,
  getEcashMnemonic,
  getKeySecret,
  storeArkMnemonic,
  storeEcashMnemonic,
  storeKeySecret
} from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import type { Account } from '@/types/models/Account'

type StoredKeySecret = {
  accountId: string
  index: number
  iv: string
  secret: string
}

type StoredMnemonic = {
  accountId: string
  mnemonic: string
}

/**
 * What a restore overwrites outside the in-memory stores: the accounts in
 * SQLite and the secrets in secure storage. Key secrets are copied as stored
 * (already encrypted), so taking the snapshot needs no PIN.
 */
export type PersistedSnapshot = {
  accounts: Account[]
  arkMnemonics: StoredMnemonic[]
  ecashMnemonics: StoredMnemonic[]
  keySecrets: StoredKeySecret[]
}

async function readKeySecrets(account: Account): Promise<StoredKeySecret[]> {
  const indexes = account.keys.map((_, index) => index)
  const secrets = await Promise.all(
    indexes.map(async (index) => {
      const stored = await getKeySecret(account.id, index)
      return stored ? { accountId: account.id, index, ...stored } : null
    })
  )
  return secrets.filter((secret) => secret !== null)
}

async function readMnemonics(
  accountIds: string[],
  read: (accountId: string) => Promise<string | null>
): Promise<StoredMnemonic[]> {
  const mnemonics = await Promise.all(
    accountIds.map(async (accountId) => {
      const mnemonic = await read(accountId)
      return mnemonic ? { accountId, mnemonic } : null
    })
  )
  return mnemonics.filter((mnemonic) => mnemonic !== null)
}

export async function snapshotPersistedState({
  arkAccountIds,
  ecashAccountIds
}: {
  arkAccountIds: string[]
  ecashAccountIds: string[]
}): Promise<PersistedSnapshot> {
  const { accounts } = useAccountsStore.getState()
  const keySecrets = await Promise.all(accounts.map(readKeySecrets))
  return {
    accounts,
    arkMnemonics: await readMnemonics(arkAccountIds, getArkMnemonic),
    ecashMnemonics: await readMnemonics(ecashAccountIds, getEcashMnemonic),
    keySecrets: keySecrets.flat()
  }
}

function idsMissingFrom(ids: string[], kept: StoredMnemonic[]): string[] {
  const keptIds = new Set(kept.map((mnemonic) => mnemonic.accountId))
  return ids.filter((id) => !keptIds.has(id))
}

/**
 * Puts back what snapshotPersistedState saved after a restore failed part way:
 * removes the restored accounts and their secrets, re-inserts the previous
 * accounts, and rewrites their key secrets and mnemonics.
 */
export async function rollbackPersistedState(
  snapshot: PersistedSnapshot,
  restored: { arkAccountIds: string[]; ecashAccountIds: string[] }
): Promise<void> {
  const accountsStore = useAccountsStore.getState()
  await accountsStore.deleteAccounts()
  for (const account of snapshot.accounts) {
    accountsStore.addAccount(account)
  }
  for (const { accountId, index, iv, secret } of snapshot.keySecrets) {
    await storeKeySecret(accountId, index, secret, iv)
  }
  await Promise.all([
    ...idsMissingFrom(restored.ecashAccountIds, snapshot.ecashMnemonics).map(
      (id) => deleteEcashMnemonic(id)
    ),
    ...idsMissingFrom(restored.arkAccountIds, snapshot.arkMnemonics).map((id) =>
      deleteArkMnemonic(id)
    ),
    ...snapshot.ecashMnemonics.map(({ accountId, mnemonic }) =>
      storeEcashMnemonic(accountId, mnemonic)
    ),
    ...snapshot.arkMnemonics.map(({ accountId, mnemonic }) =>
      storeArkMnemonic(accountId, mnemonic)
    )
  ])
}
