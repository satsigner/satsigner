import { getWalletData } from '@/api/bdk'
import { PIN_KEY } from '@/config/auth'
import { getItem, storeKeySecret } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useWalletsStore } from '@/store/wallets'
import type {
  Account,
  Key,
  MnemonicWordCount,
  Secret
} from '@/types/models/Account'
import type { Network } from '@/types/settings/blockchain'
import {
  generateMnemonic,
  getExtendedPublicKeyFromMnemonic,
  getFingerprintFromMnemonic
} from '@/utils/bip39'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { aesEncrypt, randomIv, randomUuid } from '@/utils/crypto'

type CreateSinglesigParams = {
  name: string
  network: Network
  scriptVersion: NonNullable<Key['scriptVersion']>
  mnemonicWordCount?: MnemonicWordCount
}

type CreateSinglesigResult = {
  account: Account
  mnemonic: string
}

export function useCreateSinglesigAccount() {
  const addAccount = useAccountsStore((state) => state.addAccount)
  const addAccountWallet = useWalletsStore((state) => state.addAccountWallet)

  async function createSinglesigAccount({
    name,
    network,
    scriptVersion,
    mnemonicWordCount = 12
  }: CreateSinglesigParams): Promise<CreateSinglesigResult> {
    const pin = await getItem(PIN_KEY)
    if (!pin) {
      throw new Error('Missing PIN — cannot encrypt wallet secret')
    }

    const mnemonic = generateMnemonic(mnemonicWordCount)
    const bdkNetwork = appNetworkToBdkNetwork(network)
    const derivedFingerprint = getFingerprintFromMnemonic(mnemonic)
    const extendedPublicKey = getExtendedPublicKeyFromMnemonic(
      mnemonic,
      '',
      bdkNetwork,
      scriptVersion
    )
    const iv = randomIv()
    const accountId = randomUuid()

    const plaintextSecret: Secret = {
      extendedPublicKey,
      fingerprint: derivedFingerprint,
      mnemonic
    }

    const draftKey: Key = {
      creationType: 'generateMnemonic',
      fingerprint: derivedFingerprint,
      index: 0,
      iv,
      mnemonicWordCount,
      mnemonicWordList: 'english',
      name: '',
      scriptVersion,
      secret: plaintextSecret
    }

    const draftAccount: Account = {
      addresses: [],
      createdAt: new Date(),
      id: accountId,
      keyCount: 1,
      keys: [draftKey],
      keysRequired: 1,
      labels: {},
      lastSyncedAt: new Date(),
      name,
      network,
      nostr: {
        autoSync: false,
        commonNpub: '',
        commonNsec: '',
        deviceNpub: '',
        deviceNsec: '',
        dms: [],
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

    const walletData = await getWalletData(draftAccount, bdkNetwork)
    if (!walletData) {
      throw new Error('Failed to derive on-chain wallet data')
    }

    const encryptedSecret = await aesEncrypt(
      JSON.stringify(plaintextSecret),
      pin,
      iv
    )
    await storeKeySecret(accountId, 0, encryptedSecret, iv)

    const persistedAccount: Account = {
      ...draftAccount,
      keys: [
        {
          ...draftKey,
          derivationPath: walletData.derivationPath,
          fingerprint: walletData.fingerprint,
          secret: encryptedSecret
        }
      ]
    }

    addAccount(persistedAccount)
    addAccountWallet(persistedAccount.id, walletData.wallet)

    return { account: persistedAccount, mnemonic }
  }

  return { createSinglesigAccount }
}
