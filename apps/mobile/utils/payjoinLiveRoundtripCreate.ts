import { getWalletData, getWalletOverview, syncWallet } from '@/api/bdk'
import {
  CLOWN_ACCOUNT_NAME,
  clownSignetWalletSeed,
  SAMPLE_SEGWIT_ACCOUNT_NAME,
  sampleSignetWalletSeed
} from '@/constants/samples'
import { t } from '@/locales'
import { storeKeySecret } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useWalletsStore } from '@/store/wallets'
import { type MnemonicWordCount } from '@/types/bips/39'
import { type Account, type Key, type Secret } from '@/types/models/Account'
import { type NostrDM } from '@/types/models/Nostr'
import {
  getExtendedPublicKeyFromMnemonic,
  getFingerprintFromMnemonic
} from '@/utils/bip39'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { aesEncrypt, ensurePin, randomIv, randomUuid } from '@/utils/crypto'
import {
  findClownAccount,
  findSampleAccount
} from '@/utils/payjoinLiveRoundtripAccounts'

/** Mirrors the accountBuilder store's getAccountData shape for a singlesig
 * P2WPKH mnemonic import on signet. */
function buildSeedAccount(name: string, mnemonic: string): Account {
  const bdkNetwork = appNetworkToBdkNetwork('signet')
  const fingerprint = getFingerprintFromMnemonic(mnemonic)
  const extendedPublicKey = getExtendedPublicKeyFromMnemonic(
    mnemonic,
    '',
    bdkNetwork,
    'P2WPKH'
  )
  const secret: Secret = { extendedPublicKey, fingerprint, mnemonic }
  const key: Key = {
    creationType: 'importMnemonic',
    fingerprint,
    index: 0,
    iv: randomIv(),
    mnemonicWordCount: mnemonic.trim().split(/\s+/).length as MnemonicWordCount,
    scriptVersion: 'P2WPKH',
    secret
  }

  return {
    addresses: [],
    createdAt: new Date(),
    id: randomUuid(),
    keyCount: 1,
    keys: [key],
    keysRequired: 1,
    labels: {},
    lastSyncedAt: new Date(),
    name,
    network: 'signet',
    nostr: {
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
    },
    policyType: 'singlesig',
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
  }
}

/**
 * Creates a signet singlesig wallet from a well-known seed: encrypts and
 * stores the key material (same path as useAccountBuilderFinish), registers
 * the account and its BDK wallet in the stores, then full-scans so the
 * roundtrip's funding/contribute checks see real UTXOs.
 */
async function createSeedAccount(
  name: string,
  mnemonic: string
): Promise<Account> {
  const account = buildSeedAccount(name, mnemonic)
  const bdkNetwork = appNetworkToBdkNetwork('signet')

  const walletData = await getWalletData(account, bdkNetwork)
  if (!walletData) {
    throw new Error(`failed to create wallet for ${name}`)
  }

  const pin = await ensurePin()
  const [key] = account.keys
  const encryptedSecret = await aesEncrypt(
    JSON.stringify(key.secret),
    pin,
    key.iv
  )
  await storeKeySecret(account.id, 0, encryptedSecret, key.iv)

  const isZeroFingerprint = (fp?: string) => !fp || /^0+$/.test(fp)
  const finalFingerprint = !isZeroFingerprint(walletData.fingerprint)
    ? walletData.fingerprint
    : key.fingerprint

  const accountWithEncryptedSecret: Account = {
    ...account,
    keys: [
      {
        ...key,
        derivationPath: walletData.derivationPath,
        fingerprint: finalFingerprint,
        secret: encryptedSecret
      }
    ]
  }

  useAccountsStore.getState().addAccount(accountWithEncryptedSecret)
  useWalletsStore
    .getState()
    .addAccountWallet(account.id, walletData.wallet, walletData.dbPath)

  const { selectedNetwork, configs } = useBlockchainStore.getState()
  const { server, config } = configs[selectedNetwork]
  await syncWallet(
    walletData.wallet,
    server.backend,
    server.url,
    config.stopGap,
    true,
    server.rpcCredentials
  )
  const overview = getWalletOverview(
    walletData.wallet,
    bdkNetwork,
    config.stopGap
  )

  const synced: Account = {
    ...accountWithEncryptedSecret,
    ...overview,
    lastSyncedAt: new Date(),
    syncStatus: 'synced'
  }
  useAccountsStore.getState().updateAccount(synced)
  return synced
}

/**
 * Resolves Sample (sender) and Clown (receiver) from the vault, creating and
 * syncing whichever is missing from the well-known signet seeds, so the live
 * roundtrip is one tap on a fresh install. `onStep` reports progress — a
 * create + full scan can take a while.
 */
async function ensureRoundtripAccounts(
  onStep?: (message: string) => void
): Promise<{
  sender: Account
  receiver: Account
}> {
  let sender = findSampleAccount(useAccountsStore.getState().accounts)
  if (!sender) {
    onStep?.(
      t('settings.developer.diagnosis.step.createAccount', {
        name: SAMPLE_SEGWIT_ACCOUNT_NAME
      })
    )
    sender = await createSeedAccount(
      SAMPLE_SEGWIT_ACCOUNT_NAME,
      sampleSignetWalletSeed
    )
  }

  let receiver = findClownAccount(useAccountsStore.getState().accounts)
  if (!receiver) {
    onStep?.(
      t('settings.developer.diagnosis.step.createAccount', {
        name: CLOWN_ACCOUNT_NAME
      })
    )
    receiver = await createSeedAccount(
      CLOWN_ACCOUNT_NAME,
      clownSignetWalletSeed
    )
  }

  return { receiver, sender }
}

export { buildSeedAccount, createSeedAccount, ensureRoundtripAccounts }
