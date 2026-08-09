import {
  deleteNostrAccountSecret,
  deleteNostrIdentitySecret,
  getNostrAccountSecret,
  getNostrIdentitySecret,
  storeNostrAccountSecret,
  storeNostrIdentitySecret
} from '@/storage/encrypted'
import { type Account } from '@/types/models/Account'
import { type NostrAccount, type NostrIdentity } from '@/types/models/Nostr'
import { aesDecrypt, aesEncrypt, randomIv } from '@/utils/crypto'
import { getPin } from '@/utils/pin'

export type NostrIdentitySecrets = {
  mnemonic?: string
  nsec?: string
}

export type NostrAccountSecrets = {
  commonNsec: string
  deviceMnemonic?: string
  deviceNsec?: string
}

const identitySecretsCache = new Map<string, NostrIdentitySecrets>()
const accountSecretsCache = new Map<string, NostrAccountSecrets>()

function looksLikePlaintextNsec(value: string | undefined): boolean {
  return typeof value === 'string' && value.startsWith('nsec1')
}

function looksLikePlaintextMnemonic(value: string | undefined): boolean {
  if (!value) {
    return false
  }
  const words = value.trim().split(/\s+/)
  return words.length >= 12
}

function hasIdentitySecrets(secrets: NostrIdentitySecrets): boolean {
  return Boolean(secrets.nsec || secrets.mnemonic)
}

function hasAccountSecrets(secrets: NostrAccountSecrets): boolean {
  return Boolean(
    secrets.commonNsec || secrets.deviceNsec || secrets.deviceMnemonic
  )
}

function stripAccountSecretsForDb(nostr: NostrAccount): NostrAccount {
  return {
    ...nostr,
    commonNsec: '',
    deviceMnemonic: undefined,
    deviceNsec: undefined
  }
}

function getCachedIdentitySecrets(
  npub: string
): NostrIdentitySecrets | undefined {
  return identitySecretsCache.get(npub)
}

function getCachedAccountSecrets(
  accountId: string
): NostrAccountSecrets | undefined {
  return accountSecretsCache.get(accountId)
}

function setCachedIdentitySecrets(
  npub: string,
  secrets: NostrIdentitySecrets
): void {
  if (hasIdentitySecrets(secrets)) {
    identitySecretsCache.set(npub, secrets)
  } else {
    identitySecretsCache.delete(npub)
  }
}

function setCachedAccountSecrets(
  accountId: string,
  secrets: NostrAccountSecrets
): void {
  if (hasAccountSecrets(secrets)) {
    accountSecretsCache.set(accountId, secrets)
  } else {
    accountSecretsCache.delete(accountId)
  }
}

function clearNostrSecretsCaches(): void {
  identitySecretsCache.clear()
  accountSecretsCache.clear()
}

async function encryptAndStoreIdentitySecrets(
  npub: string,
  secrets: NostrIdentitySecrets,
  pin?: string
): Promise<void> {
  if (!hasIdentitySecrets(secrets)) {
    await deleteNostrIdentitySecret(npub)
    identitySecretsCache.delete(npub)
    return
  }
  const key = pin ?? (await getPin())
  const iv = randomIv()
  const ciphertext = await aesEncrypt(JSON.stringify(secrets), key, iv)
  await storeNostrIdentitySecret(npub, ciphertext, iv)
  setCachedIdentitySecrets(npub, secrets)
}

async function loadIdentitySecrets(
  npub: string,
  pin?: string
): Promise<NostrIdentitySecrets | null> {
  const cached = identitySecretsCache.get(npub)
  if (cached) {
    return cached
  }
  const stored = await getNostrIdentitySecret(npub)
  if (!stored) {
    return null
  }
  const key = pin ?? (await getPin())
  const decrypted = await aesDecrypt(stored.secret, key, stored.iv)
  const secrets = JSON.parse(decrypted) as NostrIdentitySecrets
  setCachedIdentitySecrets(npub, secrets)
  return secrets
}

async function encryptAndStoreAccountNostrSecrets(
  accountId: string,
  secrets: NostrAccountSecrets,
  pin?: string
): Promise<void> {
  if (!hasAccountSecrets(secrets)) {
    await deleteNostrAccountSecret(accountId)
    accountSecretsCache.delete(accountId)
    return
  }
  const key = pin ?? (await getPin())
  const iv = randomIv()
  const ciphertext = await aesEncrypt(JSON.stringify(secrets), key, iv)
  await storeNostrAccountSecret(accountId, ciphertext, iv)
  setCachedAccountSecrets(accountId, secrets)
}

async function loadAccountNostrSecrets(
  accountId: string,
  pin?: string
): Promise<NostrAccountSecrets | null> {
  const cached = accountSecretsCache.get(accountId)
  if (cached) {
    return cached
  }
  const stored = await getNostrAccountSecret(accountId)
  if (!stored) {
    return null
  }
  const key = pin ?? (await getPin())
  const decrypted = await aesDecrypt(stored.secret, key, stored.iv)
  const secrets = JSON.parse(decrypted) as NostrAccountSecrets
  setCachedAccountSecrets(accountId, secrets)
  return secrets
}

function mergeAccountWithCachedNostrSecrets(account: Account): Account {
  if (!account.nostr) {
    return account
  }
  const secrets = accountSecretsCache.get(account.id)
  if (!secrets) {
    return account
  }
  return {
    ...account,
    nostr: {
      ...account.nostr,
      commonNsec: secrets.commonNsec || account.nostr.commonNsec || '',
      deviceMnemonic: secrets.deviceMnemonic || account.nostr.deviceMnemonic,
      deviceNsec: secrets.deviceNsec || account.nostr.deviceNsec
    }
  }
}

async function persistIdentitySecretsFromMemory(
  identity: NostrIdentity,
  pin?: string
): Promise<void> {
  await encryptAndStoreIdentitySecrets(
    identity.npub,
    { mnemonic: identity.mnemonic, nsec: identity.nsec },
    pin
  )
}

async function persistAccountSecretsFromNostr(
  accountId: string,
  nostr: NostrAccount | undefined,
  pin?: string
): Promise<void> {
  if (!nostr) {
    return
  }
  await encryptAndStoreAccountNostrSecrets(
    accountId,
    {
      commonNsec: nostr.commonNsec || '',
      deviceMnemonic: nostr.deviceMnemonic,
      deviceNsec: nostr.deviceNsec
    },
    pin
  )
}

/** Fire-and-forget SecureStore write; never throws to callers. */
async function persistIdentitySecretsSafe(
  identity: NostrIdentity
): Promise<void> {
  try {
    await persistIdentitySecretsFromMemory(identity)
  } catch {
    // best-effort side effect from sync store actions
  }
}

async function persistAccountSecretsSafe(
  accountId: string,
  nostr: NostrAccount | undefined
): Promise<void> {
  try {
    await persistAccountSecretsFromNostr(accountId, nostr)
  } catch {
    // best-effort side effect from sync store actions
  }
}

async function deleteNostrIdentitySecretSafe(npub: string): Promise<void> {
  try {
    await deleteNostrIdentitySecret(npub)
  } catch {
    // best-effort cleanup
  }
}

async function deleteNostrAccountSecretSafe(accountId: string): Promise<void> {
  try {
    await deleteNostrAccountSecret(accountId)
  } catch {
    // best-effort cleanup
  }
}

/**
 * Move plaintext Nostr secrets out of MMKV/SQLite into PIN-encrypted SecureStore,
 * then hydrate in-memory caches/stores for the unlocked session.
 */
async function migrateAndHydrateNostrSecrets(): Promise<void> {
  let pin: string
  try {
    pin = await getPin()
  } catch {
    return
  }

  const { useNostrIdentityStore } = await import('@/store/nostrIdentity')
  const { useAccountsStore } = await import('@/store/accounts')

  const identityStore = useNostrIdentityStore.getState()
  const nextIdentities: NostrIdentity[] = []

  for (const identity of identityStore.identities) {
    const plaintext: NostrIdentitySecrets = {
      mnemonic: looksLikePlaintextMnemonic(identity.mnemonic)
        ? identity.mnemonic
        : undefined,
      nsec: looksLikePlaintextNsec(identity.nsec) ? identity.nsec : undefined
    }

    if (hasIdentitySecrets(plaintext)) {
      await encryptAndStoreIdentitySecrets(identity.npub, plaintext, pin)
      nextIdentities.push({
        ...identity,
        mnemonic: plaintext.mnemonic,
        nsec: plaintext.nsec
      })
      continue
    }

    const loaded = await loadIdentitySecrets(identity.npub, pin)
    nextIdentities.push({
      ...identity,
      mnemonic: loaded?.mnemonic,
      nsec: loaded?.nsec
    })
  }

  useNostrIdentityStore.setState({ identities: nextIdentities })

  const accountsStore = useAccountsStore.getState()
  for (const account of accountsStore.accounts) {
    if (!account.nostr) {
      continue
    }

    const plaintext: NostrAccountSecrets = {
      commonNsec: looksLikePlaintextNsec(account.nostr.commonNsec)
        ? account.nostr.commonNsec
        : '',
      deviceMnemonic: looksLikePlaintextMnemonic(account.nostr.deviceMnemonic)
        ? account.nostr.deviceMnemonic
        : undefined,
      deviceNsec: looksLikePlaintextNsec(account.nostr.deviceNsec)
        ? account.nostr.deviceNsec
        : undefined
    }

    if (hasAccountSecrets(plaintext)) {
      await encryptAndStoreAccountNostrSecrets(account.id, plaintext, pin)
      // Keep secrets in memory; DB write path strips them.
      accountsStore.updateAccountNostr(account.id, {
        commonNsec: plaintext.commonNsec,
        deviceMnemonic: plaintext.deviceMnemonic,
        deviceNsec: plaintext.deviceNsec
      })
      continue
    }

    const loaded = await loadAccountNostrSecrets(account.id, pin)
    if (!loaded) {
      continue
    }
    accountsStore.updateAccountNostr(account.id, {
      commonNsec: loaded.commonNsec,
      deviceMnemonic: loaded.deviceMnemonic,
      deviceNsec: loaded.deviceNsec
    })
  }
}

async function reEncryptNostrSecrets(
  oldPinEncrypted: string,
  newPinEncrypted: string
): Promise<void> {
  const { useNostrIdentityStore } = await import('@/store/nostrIdentity')
  const { useAccountsStore } = await import('@/store/accounts')

  const { identities } = useNostrIdentityStore.getState()
  for (const identity of identities) {
    const stored = await getNostrIdentitySecret(identity.npub)
    if (!stored) {
      continue
    }
    const decrypted = await aesDecrypt(
      stored.secret,
      oldPinEncrypted,
      stored.iv
    )
    const secrets = JSON.parse(decrypted) as NostrIdentitySecrets
    await encryptAndStoreIdentitySecrets(
      identity.npub,
      secrets,
      newPinEncrypted
    )
  }

  const { accounts } = useAccountsStore.getState()
  for (const account of accounts) {
    const stored = await getNostrAccountSecret(account.id)
    if (!stored) {
      continue
    }
    const decrypted = await aesDecrypt(
      stored.secret,
      oldPinEncrypted,
      stored.iv
    )
    const secrets = JSON.parse(decrypted) as NostrAccountSecrets
    await encryptAndStoreAccountNostrSecrets(
      account.id,
      secrets,
      newPinEncrypted
    )
  }
}

async function deleteAllNostrSecretsForWipe(
  identityNpubs: string[],
  accountIds: string[]
): Promise<void> {
  await Promise.all([
    ...identityNpubs.map((npub) =>
      deleteNostrIdentitySecret(npub).catch(() => undefined)
    ),
    ...accountIds.map((accountId) =>
      deleteNostrAccountSecret(accountId).catch(() => undefined)
    )
  ])
  clearNostrSecretsCaches()
}

export {
  clearNostrSecretsCaches,
  deleteAllNostrSecretsForWipe,
  deleteNostrAccountSecret,
  deleteNostrAccountSecretSafe,
  deleteNostrIdentitySecret,
  deleteNostrIdentitySecretSafe,
  encryptAndStoreAccountNostrSecrets,
  encryptAndStoreIdentitySecrets,
  getCachedAccountSecrets,
  getCachedIdentitySecrets,
  hasAccountSecrets,
  hasIdentitySecrets,
  loadAccountNostrSecrets,
  loadIdentitySecrets,
  looksLikePlaintextMnemonic,
  looksLikePlaintextNsec,
  mergeAccountWithCachedNostrSecrets,
  migrateAndHydrateNostrSecrets,
  persistAccountSecretsFromNostr,
  persistAccountSecretsSafe,
  persistIdentitySecretsFromMemory,
  persistIdentitySecretsSafe,
  reEncryptNostrSecrets,
  setCachedAccountSecrets,
  setCachedIdentitySecrets,
  stripAccountSecretsForDb
}
