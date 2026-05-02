import {
  deleteEcashMnemonic,
  storeEcashMnemonic,
  storeKeySecret
} from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useEcashStore } from '@/store/ecash'
import { useNostrStore } from '@/store/nostr'
import { useSettingsStore } from '@/store/settings'
import { useWalletsStore } from '@/store/wallets'
import { type Account, type Key } from '@/types/models/Account'
import {
  type EcashAccount,
  type EcashKeysetCounter,
  type EcashMint,
  type EcashProof,
  type EcashTransaction,
  type MeltQuote,
  type MintQuote
} from '@/types/models/Ecash'
import { type NostrAccount, type NostrDM } from '@/types/models/Nostr'
import { aesEncrypt, getPinForDecryption, randomIv } from '@/utils/crypto'
import { resetInstance as resetNostrSync } from '@/utils/nostrSyncService'

type BackupKey = Key & {
  passphrase?: string
  seedWords?: string
}
type BackupAccount = {
  id: string
  keys: BackupKey[]
  keysRequired?: number
  name: string
  network: Account['network']
  nostr?: NostrAccount
  policyType: Account['policyType']
  summary?: Account['summary']
}
type BackupData = {
  accounts: BackupAccount[]
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
  nostr?: {
    lastDataExchangeEOSE?: Record<string, number>
    lastProtocolEOSE?: Record<string, number>
    members?: Record<string, { color: string; npub: string }[]>
    processedEvents?: Record<string, Record<string, true>>
    processedMessageIds?: Record<string, Record<string, true>>
    profiles?: Record<string, { displayName?: string; picture?: string }>
    trustedDevices?: Record<string, string[]>
  }
  settings: {
    currencyUnit: string
    mnemonicWordList: string
    useZeroPadding: boolean
  }
  version: number
}

function parseBackupDate(v: string | number | Date | null | undefined): Date {
  if (v === null || v === undefined) {
    return new Date()
  }
  return new Date(v as string | number | Date)
}

/**
 * Overwrites app data with the decrypted backup. Call after PIN unlock when
 * pendingRecoverData is set. Uses stored PIN from secure storage.
 */
export async function performRecoverOverwrite(
  decrypted: string
): Promise<{ success: boolean }> {
  const { skipPin } = useAuthStore.getState()
  const pin = await getPinForDecryption(skipPin)
  if (!pin) {
    return { success: false }
  }
  try {
    const data = JSON.parse(decrypted) as BackupData
    if (!data.accounts || !Array.isArray(data.accounts)) {
      throw new Error('Invalid backup format')
    }
    const restoredAccounts: Account[] = []
    const existingEcashAccounts = useEcashStore.getState().accounts
    for (const acc of data.accounts) {
      const keys: Key[] = []
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
        await storeKeySecret(acc.id, k.index, secret, iv)
        keys.push({
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
      restoredAccounts.push({
        addresses: [],
        createdAt: typeof created === 'string' ? new Date(created) : new Date(),
        id: acc.id,
        keyCount: acc.keys.length,
        keys,
        keysRequired:
          acc.policyType === 'singlesig'
            ? 1
            : (acc.keysRequired ?? acc.keys.length),
        labels: {},
        lastSyncedAt: new Date(),
        name: acc.name,
        network: acc.network,
        nostr,
        policyType: acc.policyType,
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
    resetNostrSync()
    useNostrStore.getState().clearAllNostrState()
    useEcashStore.getState().clearAllData()
    await Promise.all(
      existingEcashAccounts.map((account) => deleteEcashMnemonic(account.id))
    )
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
      if (data.ecash.mnemonics) {
        await Promise.all(
          Object.entries(data.ecash.mnemonics)
            .filter((entry): entry is [string, string] => Boolean(entry[1]))
            .map(([accountId, mnemonic]) =>
              storeEcashMnemonic(accountId, mnemonic)
            )
        )
      }
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
    return { success: true }
  } catch {
    return { success: false }
  }
}
