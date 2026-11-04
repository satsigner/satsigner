import {
  deleteArkMnemonic,
  deleteEcashMnemonic,
  deleteNostrIdentitySecret,
  getArkMnemonic,
  getEcashMnemonic,
  getKeySecret,
  getNostrAccountSecret,
  getNostrIdentitySecret,
  storeArkMnemonic,
  storeEcashMnemonic,
  storeKeySecret,
  storeNostrAccountSecret,
  storeNostrIdentitySecret
} from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import type { Account, EncryptedKeySecret } from '@/types/models/Account'

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

type StoredNostrAccountSecret = EncryptedKeySecret & { accountId: string }

type StoredNostrIdentitySecret = EncryptedKeySecret & { npub: string }

/**
 * What a restore overwrites outside the in-memory stores: the accounts in
 * SQLite and the secrets in secure storage. Key and nostr secrets are copied
 * as stored (already encrypted), so taking the snapshot needs no PIN.
 */
export type PersistedSnapshot = {
  accounts: Account[]
  arkMnemonics: StoredMnemonic[]
  ecashMnemonics: StoredMnemonic[]
  keySecrets: StoredKeySecret[]
  nostrAccountSecrets: StoredNostrAccountSecret[]
  nostrIdentitySecrets: StoredNostrIdentitySecret[]
}

export type RestoredIds = {
  arkAccountIds: string[]
  ecashAccountIds: string[]
  nostrIdentityNpubs: string[]
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

async function readNostrAccountSecrets(
  accountIds: string[]
): Promise<StoredNostrAccountSecret[]> {
  const secrets = await Promise.all(
    accountIds.map(async (accountId) => {
      const stored = await getNostrAccountSecret(accountId)
      return stored ? { accountId, ...stored } : null
    })
  )
  return secrets.filter((secret) => secret !== null)
}

async function readNostrIdentitySecrets(
  npubs: string[]
): Promise<StoredNostrIdentitySecret[]> {
  const secrets = await Promise.all(
    npubs.map(async (npub) => {
      const stored = await getNostrIdentitySecret(npub)
      return stored ? { npub, ...stored } : null
    })
  )
  return secrets.filter((secret) => secret !== null)
}

export async function snapshotPersistedState({
  arkAccountIds,
  ecashAccountIds
}: {
  arkAccountIds: string[]
  ecashAccountIds: string[]
}): Promise<PersistedSnapshot> {
  const { accounts } = useAccountsStore.getState()
  const { identities } = useNostrIdentityStore.getState()
  const keySecrets = await Promise.all(accounts.map(readKeySecrets))
  return {
    accounts,
    arkMnemonics: await readMnemonics(arkAccountIds, getArkMnemonic),
    ecashMnemonics: await readMnemonics(ecashAccountIds, getEcashMnemonic),
    keySecrets: keySecrets.flat(),
    nostrAccountSecrets: await readNostrAccountSecrets(
      accounts.map((account) => account.id)
    ),
    nostrIdentitySecrets: await readNostrIdentitySecrets(
      identities.map((identity) => identity.npub)
    )
  }
}

function idsMissingFrom(ids: string[], keptIds: string[]): string[] {
  const kept = new Set(keptIds)
  return ids.filter((id) => !kept.has(id))
}

function mnemonicAccountIds(mnemonics: StoredMnemonic[]): string[] {
  return mnemonics.map((mnemonic) => mnemonic.accountId)
}

/**
 * Puts back what snapshotPersistedState saved after a restore failed part way:
 * removes the restored accounts and their secrets, re-inserts the previous
 * accounts, and rewrites their key secrets, nostr secrets and mnemonics.
 * Safe to run again if it fails part way.
 */
export async function rollbackPersistedState(
  snapshot: PersistedSnapshot,
  restored: RestoredIds
): Promise<void> {
  const accountsStore = useAccountsStore.getState()
  await accountsStore.deleteAccounts()
  for (const account of snapshot.accounts) {
    accountsStore.addAccount(account)
  }
  for (const { accountId, index, iv, secret } of snapshot.keySecrets) {
    await storeKeySecret(accountId, index, secret, iv)
  }
  const snapshotNpubs = snapshot.nostrIdentitySecrets.map(({ npub }) => npub)
  await Promise.all([
    ...idsMissingFrom(
      restored.ecashAccountIds,
      mnemonicAccountIds(snapshot.ecashMnemonics)
    ).map((id) => deleteEcashMnemonic(id)),
    ...idsMissingFrom(
      restored.arkAccountIds,
      mnemonicAccountIds(snapshot.arkMnemonics)
    ).map((id) => deleteArkMnemonic(id)),
    ...idsMissingFrom(restored.nostrIdentityNpubs, snapshotNpubs).map((npub) =>
      deleteNostrIdentitySecret(npub)
    ),
    ...snapshot.nostrIdentitySecrets.map(({ iv, npub, secret }) =>
      storeNostrIdentitySecret(npub, secret, iv)
    ),
    ...snapshot.nostrAccountSecrets.map(({ accountId, iv, secret }) =>
      storeNostrAccountSecret(accountId, secret, iv)
    ),
    ...snapshot.ecashMnemonics.map(({ accountId, mnemonic }) =>
      storeEcashMnemonic(accountId, mnemonic)
    ),
    ...snapshot.arkMnemonics.map(({ accountId, mnemonic }) =>
      storeArkMnemonic(accountId, mnemonic)
    )
  ])
}
