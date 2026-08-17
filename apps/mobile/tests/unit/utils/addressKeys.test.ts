import { type Account } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { mnemonicToSeed } from '@/utils/bip39'
import { getAddressDerivationPath } from '@/utils/bitcoin'
import { getAddressKeyPair } from '@/utils/key'

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

// m/84'/0'/0'/0/3 for TEST_MNEMONIC, verified against an independent
// bip32 implementation.
const EXPECTED_PRIVATE_KEY_HEX =
  '2048fa6e298fcac0e786e4bacc01b27579aed37b0b9e0dcb31e114d6f91d6392'
const EXPECTED_PUBLIC_KEY_HEX =
  '03de7490bcca92a2fb57d782c3fd60548ce3a842cad6f3a8d4e76d1f2ff7fcdb89'
const EXPECTED_ADDRESS = 'bc1qgl5vlg0zdl7yvprgxj9fevsc6q6x5dmcyk3cn3'

const account: Account = {
  addresses: [],
  createdAt: new Date('2024-01-01'),
  id: 'acc-1',
  keyCount: 1,
  keys: [
    {
      creationType: 'generateMnemonic',
      index: 0,
      iv: '',
      scriptVersion: 'P2WPKH',
      secret: ''
    }
  ],
  keysRequired: 1,
  labels: {},
  name: 'Test',
  network: 'bitcoin',
  nostr: {
    autoSync: false,
    commonNpub: '',
    commonNsec: '',
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
  syncStatus: 'synced',
  transactions: [],
  utxos: []
}

// As built by api/bdk.ts#getWalletAddresses: no derivationPath field.
const addressAtIndex3: Address = {
  address: EXPECTED_ADDRESS,
  index: 3,
  keychain: 'external',
  label: '',
  scriptVersion: 'P2WPKH',
  summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
  transactions: [],
  utxos: []
}

// Regression: reconstructed path was missing the change level, deriving the wrong key.
describe('address key derivation regression', () => {
  it('derives the correct BIP84 path for an address missing derivationPath', () => {
    expect(getAddressDerivationPath(account, addressAtIndex3)).toBe(
      "84'/0'/0'/0/3"
    )
  })

  it('getAddressKeyPair produces the correct key pair, matching an independent BIP32 implementation', () => {
    const derivationPath = getAddressDerivationPath(account, addressAtIndex3)
    const addressWithDerivationPath: Address = {
      ...addressAtIndex3,
      derivationPath
    }

    const keyPair = getAddressKeyPair(
      { mnemonic: TEST_MNEMONIC },
      addressWithDerivationPath,
      account.network
    )

    expect(keyPair).not.toBeNull()
    expect(keyPair?.privateKey).toBe(EXPECTED_PRIVATE_KEY_HEX)
    expect(keyPair?.publicKey).toBe(EXPECTED_PUBLIC_KEY_HEX)
  })

  it('mnemonicToSeed matches the standard bip39 test vector seed', () => {
    const seed = mnemonicToSeed(TEST_MNEMONIC)
    expect(Buffer.from(seed).toString('hex')).toBe(
      '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4'
    )
  })
})
