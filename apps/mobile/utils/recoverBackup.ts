import {
  deleteArkMnemonic,
  deleteEcashMnemonic,
  storeArkMnemonic,
  storeEcashMnemonic,
  storeKeySecret
} from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useArkStore } from '@/store/ark'
import { useBlockchainStore } from '@/store/blockchain'
import { useEcashStore } from '@/store/ecash'
import { useLightningStore } from '@/store/lightning'
import { useNostrStore } from '@/store/nostr'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useSettingsStore } from '@/store/settings'
import { useWalletsStore } from '@/store/wallets'
import type { Label } from '@/types/bips/329'
import type { Account, Key } from '@/types/models/Account'
import type {
  EcashAccount,
  EcashKeysetCounter,
  EcashMint,
  EcashProof,
  EcashTransaction,
  MeltQuote,
  MintQuote
} from '@/types/models/Ecash'
import type {
  LNDChannel,
  LNDConfig,
  LNDNodeInfo
} from '@/types/models/Lightning'
import type { NostrAccount, NostrDM, NostrIdentity } from '@/types/models/Nostr'
import {
  prepareArkMnemonics,
  restoreArkDatadirsFromBackup,
  restoreArkLabelsFromBackup,
  restoreArkStoreFromBackup,
  type ArkBackupSection
} from '@/utils/arkBackup'
import {
  restoreBlockchainFromBackup,
  type BlockchainBackup
} from '@/utils/blockchainBackup'
import { aesEncrypt, randomIv } from '@/utils/crypto'
import { restoreLightningFromBackup } from '@/utils/lightningBackup'
import { resetInstance as resetNostrSync } from '@/utils/nostrSyncService'
import { getPin } from '@/utils/pin'

type BackupKey = Key & {
  passphrase?: string
  seedWords?: string
}
type BackupAccount = {
  birthdayDate?: string
  excludedUtxoOutpoints?: string[]
  id: string
  keys: BackupKey[]
  keysRequired?: number
  labels?: Record<string, Label>
  name: string
  network: Account['network']
  nostr?: NostrAccount
  policyType: Account['policyType']
  rpcLastBlockHash?: string
  summary?: Account['summary']
}
type BackupData = {
  accounts: BackupAccount[]
  ark?: ArkBackupSection
  ecash?: {
    accounts?: EcashAccount[]
    activeAccountId?: string | null
    counters?: Record<string, EcashKeysetCounter[]>
    mints?: Record<string, EcashMint[]>
    mnemonics?: Record<string, string | null>
    proofs?: Record<string, EcashProof[]>
    quotes?: Record<string, { melt: MeltQuote[]; mint: MintQuote[] }>
    transactions?: Record<string, EcashTransaction[]>
  }
  lightning?: {
    channels?: LNDChannel[]
    config?: LNDConfig | null
    isConnected?: boolean
    lastSync?: string | null
    nodeInfo?: LNDNodeInfo | null
  }
  lnd?: LNDConfig | null
  nostr?: {
    lastDataExchangeEOSE?: Record<string, number>
    lastProtocolEOSE?: Record<string, number>
    members?: Record<string, { color: string; npub: string }[]>
    processedEvents?: Record<string, Record<string, true>>
    processedMessageIds?: Record<string, Record<string, true>>
    profiles?: Record<string, { displayName?: string; picture?: string }>
    trustedDevices?: Record<string, string[]>
  }
  nostrIdentities?: {
    activeIdentityNpub: string | null
    identities: NostrIdentity[]
    relays: string[]
  }
  serverSettings?: BlockchainBackup
  settings: {
    currencyUnit: string
    mnemonicWordList: string
    useZeroPadding: boolean
  }
  version: number
}

type PreparedKey = {
  accountId: string
  index: number
  iv: string
  secret: string
}

type PreparedMnemonic = {
  accountId: string
  mnemonic: string
}

type PreparedRestore = {
  accounts: Account[]
  arkMnemonics: PreparedMnemonic[]
  ecashMnemonics: PreparedMnemonic[]
  keys: PreparedKey[]
}

type StoreSnapshot = {
  accounts: ReturnType<typeof useAccountsStore.getState>
  ark: ReturnType<typeof useArkStore.getState>
  blockchain: ReturnType<typeof useBlockchainStore.getState>
  ecash: ReturnType<typeof useEcashStore.getState>
  lightning: ReturnType<typeof useLightningStore.getState>
  nostr: ReturnType<typeof useNostrStore.getState>
  nostrIdentity: ReturnType<typeof useNostrIdentityStore.getState>
  settings: ReturnType<typeof useSettingsStore.getState>
  wallets: ReturnType<typeof useWalletsStore.getState>
}

export type RecoverResult =
  | { success: false; error: string }
  | { success: true }

function parseBackupDate(v: string | number | Date | null | undefined): Date {
  if (v === null || v === undefined) {
    return new Date()
  }
  return new Date(v as string | number | Date)
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }
  if (typeof err === 'string') {
    return err
  }
  return 'Unknown error'
}

function validateBackup(
  decrypted: string
): { ok: false; error: string } | { ok: true; value: BackupData } {
  let parsed: unknown
  try {
    parsed = JSON.parse(decrypted)
  } catch (error) {
    return { error: errorMessage(error), ok: false }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { error: 'Backup payload is not an object', ok: false }
  }
  const data = parsed as Partial<BackupData>
  if (!data.accounts || !Array.isArray(data.accounts)) {
    return { error: 'Backup missing accounts array', ok: false }
  }
  for (const acc of data.accounts) {
    if (!acc || !Array.isArray(acc.keys)) {
      return { error: 'Backup account missing keys array', ok: false }
    }
    for (const k of acc.keys) {
      if (k.seedWords === undefined && k.passphrase === undefined) {
        return { error: 'Backup key missing seed data', ok: false }
      }
    }
  }
  return { ok: true, value: parsed as BackupData }
}

async function prepareRestore(
  data: BackupData,
  pin: string
): Promise<PreparedRestore> {
  const accounts: Account[] = []
  const keys: PreparedKey[] = []
  for (const [accountDisplayIndex, acc] of data.accounts.entries()) {
    const accountKeys: Key[] = []
    for (const k of acc.keys) {
      const secretObj =
        k.seedWords !== undefined || k.passphrase !== undefined
          ? {
              ...(k.seedWords !== undefined && { mnemonic: k.seedWords }),
              ...(k.passphrase !== undefined && {
                passphrase: k.passphrase
              })
            }
          : undefined
      if (secretObj === undefined) {
        throw new Error('Key missing seed data')
      }
      const iv = randomIv()
      const secret = await aesEncrypt(JSON.stringify(secretObj), pin, iv)
      keys.push({ accountId: acc.id, index: k.index, iv, secret })
      accountKeys.push({
        creationType: k.creationType,
        derivationPath: k.derivationPath,
        fingerprint: k.fingerprint,
        index: k.index,
        iv,
        mnemonicWordCount: k.mnemonicWordCount,
        mnemonicWordList: k.mnemonicWordList,
        name: k.name,
        scriptVersion: k.scriptVersion,
        secret
      })
    }
    const defaultNostr: NostrAccount = {
      autoSync: false,
      commonNpub: '',
      commonNsec: '',
      deviceNpub: '',
      deviceNsec: '',
      dms: [] as NostrDM[],
      lastUpdated: new Date(),
      relays: [],
      syncStart: new Date(),
      trustedMemberDevices: []
    }
    const nostr: NostrAccount = acc.nostr
      ? {
          ...defaultNostr,
          ...acc.nostr,
          lastUpdated: parseBackupDate(acc.nostr.lastUpdated),
          syncStart: parseBackupDate(acc.nostr.syncStart)
        }
      : defaultNostr
    const created = (acc as { createdAt?: string }).createdAt
    accounts.push({
      addresses: [],
      birthdayDate: acc.birthdayDate ? new Date(acc.birthdayDate) : undefined,
      createdAt: typeof created === 'string' ? new Date(created) : new Date(),
      displayIndex: accountDisplayIndex,
      excludedUtxoOutpoints: acc.excludedUtxoOutpoints ?? [],
      id: acc.id,
      keyCount: acc.keys.length,
      keys: accountKeys,
      keysRequired:
        acc.policyType === 'singlesig'
          ? 1
          : (acc.keysRequired ?? acc.keys.length),
      labels: acc.labels ?? {},
      lastSyncedAt: new Date(),
      name: acc.name,
      network: acc.network,
      nostr,
      policyType: acc.policyType,
      rpcLastBlockHash: acc.rpcLastBlockHash,
      summary: {
        balance: 0,
        numberOfAddresses: 0,
        numberOfTransactions: 0,
        numberOfUtxos: 0,
        satsInMempool: 0
      },
      syncProgress: { tasksDone: 0, totalTasks: 0 },
      syncStatus: 'unsynced',
      transactions: [],
      utxos: []
    })
  }
  const ecashMnemonics: PreparedMnemonic[] = data.ecash?.mnemonics
    ? Object.entries(data.ecash.mnemonics)
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
        .map(([accountId, mnemonic]) => ({ accountId, mnemonic }))
    : []
  const arkMnemonics = prepareArkMnemonics(data.ark?.mnemonics)
  return { accounts, arkMnemonics, ecashMnemonics, keys }
}

function snapshotStores(): StoreSnapshot {
  return {
    accounts: useAccountsStore.getState(),
    ark: useArkStore.getState(),
    blockchain: useBlockchainStore.getState(),
    ecash: useEcashStore.getState(),
    lightning: useLightningStore.getState(),
    nostr: useNostrStore.getState(),
    nostrIdentity: useNostrIdentityStore.getState(),
    settings: useSettingsStore.getState(),
    wallets: useWalletsStore.getState()
  }
}

function rollbackStores(snap: StoreSnapshot): void {
  useAccountsStore.setState(snap.accounts, true)
  useArkStore.setState(snap.ark, true)
  useBlockchainStore.setState(snap.blockchain, true)
  useEcashStore.setState(snap.ecash, true)
  useLightningStore.setState(snap.lightning, true)
  useNostrStore.setState(snap.nostr, true)
  useNostrIdentityStore.setState(snap.nostrIdentity, true)
  useSettingsStore.setState(snap.settings, true)
  useWalletsStore.setState(snap.wallets, true)
}

function applyStoreRestore(
  data: BackupData,
  restoredAccounts: Account[],
  leftoverArkAccountIds: string[]
): void {
  resetNostrSync()
  useNostrStore.getState().clearAllNostrState()
  useEcashStore.getState().clearAllData()
  useAccountsStore.getState().deleteAccounts()
  useWalletsStore.getState().deleteWallets()
  for (const account of restoredAccounts) {
    useAccountsStore.getState().addAccount(account)
  }
  if (data.nostr) {
    useNostrStore.setState({
      activeSubscriptions: new Set(),
      lastDataExchangeEOSE: data.nostr.lastDataExchangeEOSE ?? {},
      lastProtocolEOSE: data.nostr.lastProtocolEOSE ?? {},
      members: data.nostr.members ?? {},
      processedEvents: data.nostr.processedEvents ?? {},
      processedMessageIds: data.nostr.processedMessageIds ?? {},
      profiles: data.nostr.profiles ?? {},
      syncStatus: {},
      syncingAccounts: {},
      transactionToShare: null,
      trustedDevices: data.nostr.trustedDevices ?? {}
    })
  }
  if (data.ecash) {
    useEcashStore.setState({
      accounts: data.ecash.accounts ?? [],
      activeAccountId: data.ecash.activeAccountId ?? null,
      checkingTransactionIds: [],
      counters: data.ecash.counters ?? {},
      mints: data.ecash.mints ?? {},
      proofs: data.ecash.proofs ?? {},
      quotes: data.ecash.quotes ?? {},
      transactions: data.ecash.transactions ?? {}
    })
  }
  if (data.settings) {
    const cur = useSettingsStore.getState()
    if (
      data.settings.currencyUnit === 'sats' ||
      data.settings.currencyUnit === 'btc'
    ) {
      cur.setCurrencyUnit(data.settings.currencyUnit)
    }
    if (
      data.settings.mnemonicWordList !== null &&
      data.settings.mnemonicWordList !== undefined
    ) {
      cur.setMnemonicWordList(
        data.settings.mnemonicWordList as Parameters<
          typeof cur.setMnemonicWordList
        >[0]
      )
    }
    if (typeof data.settings.useZeroPadding === 'boolean') {
      cur.setUseZeroPadding(data.settings.useZeroPadding)
    }
  }
  restoreLightningFromBackup(data)
  useNostrIdentityStore.getState().clearAll()
  if (data.nostrIdentities) {
    for (const identity of data.nostrIdentities.identities) {
      useNostrIdentityStore.getState().addIdentity(identity)
    }
    useNostrIdentityStore
      .getState()
      .setActiveIdentity(data.nostrIdentities.activeIdentityNpub)
    useNostrIdentityStore.getState().setRelays(data.nostrIdentities.relays)
  }
  restoreArkStoreFromBackup(data.ark)
  const restoredArkIds = data.ark?.accounts.map((account) => account.id) ?? []
  restoreArkLabelsFromBackup(
    data.ark?.labels,
    leftoverArkAccountIds,
    restoredArkIds
  )
  if (data.serverSettings) {
    restoreBlockchainFromBackup(data.serverSettings)
  }
}

async function writeKeychain(
  prepared: PreparedRestore,
  existingEcashAccountIds: string[],
  leftoverArkAccountIds: string[]
): Promise<void> {
  for (const k of prepared.keys) {
    await storeKeySecret(k.accountId, k.index, k.secret, k.iv)
  }
  await Promise.all(
    prepared.ecashMnemonics.map((m) =>
      storeEcashMnemonic(m.accountId, m.mnemonic)
    )
  )
  const restoredEcashIds = new Set(
    prepared.ecashMnemonics.map((m) => m.accountId)
  )
  const toDelete = existingEcashAccountIds.filter(
    (id) => !restoredEcashIds.has(id)
  )
  await Promise.all(toDelete.map((id) => deleteEcashMnemonic(id)))
  await Promise.all(
    prepared.arkMnemonics.map((m) => storeArkMnemonic(m.accountId, m.mnemonic))
  )
  await Promise.all(
    leftoverArkAccountIds.map((id) =>
      deleteArkMnemonic(id).catch(() => undefined)
    )
  )
}

/**
 * Overwrites app data with the decrypted backup. Call after PIN unlock when
 * pendingRecoverData is set. Uses stored PIN from secure storage.
 *
 * Order is: validate → encrypt secrets in memory → snapshot stores → apply
 * store changes → write keychain. Any failure during apply rolls back stores
 * to their pre-restore state. Keychain writes happen last; rollback for those
 * is best-effort since secure-storage reads are PIN-bound.
 */
export async function performRecoverOverwrite(
  decrypted: string
): Promise<RecoverResult> {
  let pin = ''
  try {
    pin = await getPin()
  } catch {
    return { error: 'PIN unavailable', success: false }
  }

  const validation = validateBackup(decrypted)
  if (!validation.ok) {
    return { error: validation.error, success: false }
  }
  const data = validation.value

  let prepared: PreparedRestore
  try {
    prepared = await prepareRestore(data, pin)
  } catch (error) {
    return { error: errorMessage(error), success: false }
  }

  const existingEcashAccountIds = useEcashStore
    .getState()
    .accounts.map((a) => a.id)
  const existingArkAccountIds = useArkStore.getState().accounts.map((a) => a.id)
  const restoredArkIds = new Set(
    data.ark?.accounts.map((account) => account.id)
  )
  const leftoverArkAccountIds = existingArkAccountIds.filter(
    (id) => !restoredArkIds.has(id)
  )
  const snapshot = snapshotStores()

  try {
    applyStoreRestore(data, prepared.accounts, leftoverArkAccountIds)
  } catch (error) {
    rollbackStores(snapshot)
    return { error: errorMessage(error), success: false }
  }

  try {
    await writeKeychain(
      prepared,
      existingEcashAccountIds,
      leftoverArkAccountIds
    )
    await restoreArkDatadirsFromBackup(
      data.ark?.datadirs,
      leftoverArkAccountIds,
      data.ark?.accounts.map((account) => account.id) ?? []
    )
  } catch (error) {
    rollbackStores(snapshot)
    return { error: errorMessage(error), success: false }
  }

  return { success: true }
}
