import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useNostrStore } from '@/store/nostr'
import { useSettingsStore } from '@/store/settings'
import { useWalletsStore } from '@/store/wallets'
import { type Account, type Key } from '@/types/models/Account'
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
  settings: {
    currencyUnit: string
    mnemonicWordList: string
    useZeroPadding: boolean
  }
  version: number
}

function parseBackupDate(v: string | number | Date | null | undefined): Date {
  if (v == null) return new Date()
  return new Date(v as string | number | Date)
}

/**
 * Overwrites app data with the decrypted backup. Call after PIN unlock when
 * pendingRecoverData is set. Uses stored PIN from secure storage.
 */
export async function performRecoverOverwrite(
  decrypted: string
): Promise<{ success: boolean }> {
  const skipPin = useAuthStore.getState().skipPin
  const pin = await getPinForDecryption(skipPin)
  if (!pin) return { success: false }
  try {
    const data = JSON.parse(decrypted) as BackupData
    if (!data.accounts || !Array.isArray(data.accounts)) {
      throw new Error('Invalid backup format')
    }
    const restoredAccounts: Account[] = []
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
        if (secretObj === undefined) throw new Error('Key missing seed data')
        const iv = randomIv()
        const secret = await aesEncrypt(JSON.stringify(secretObj), pin, iv)
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
        commonNpub: '',
        commonNsec: '',
        relays: [],
        autoSync: false,
        deviceNpub: '',
        deviceNsec: '',
        trustedMemberDevices: [],
        dms: [] as NostrDM[],
        lastUpdated: new Date(),
        syncStart: new Date()
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
        id: acc.id,
        name: acc.name,
        network: acc.network,
        policyType: acc.policyType,
        keys,
        keyCount: acc.keys.length,
        keysRequired:
          acc.policyType === 'singlesig'
            ? 1
            : acc.keysRequired ?? acc.keys.length,
        summary: {
          balance: 0,
          numberOfAddresses: 0,
          numberOfTransactions: 0,
          numberOfUtxos: 0,
          satsInMempool: 0
        },
        transactions: [],
        utxos: [],
        addresses: [],
        labels: {},
        createdAt: typeof created === 'string' ? new Date(created) : new Date(),
        lastSyncedAt: new Date(),
        syncStatus: 'unsynced',
        syncProgress: { tasksDone: 0, totalTasks: 0 },
        nostr
      })
    }
    resetNostrSync()
    useNostrStore.getState().clearAllNostrState()
    useAccountsStore.getState().deleteAccounts()
    useWalletsStore.getState().deleteWallets()
    for (const account of restoredAccounts) {
      useAccountsStore.getState().addAccount(account)
    }
    if (data.settings) {
      const cur = useSettingsStore.getState()
      if (
        data.settings.currencyUnit === 'sats' ||
        data.settings.currencyUnit === 'btc'
      ) {
        cur.setCurrencyUnit(data.settings.currencyUnit)
      }
      if (data.settings.mnemonicWordList != null) {
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
