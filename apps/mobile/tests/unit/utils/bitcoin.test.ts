import { type Account, type Key } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import {
  bip21decode,
  getAddressDerivationPath,
  isBip21,
  isBitcoinAddress,
  privateKeyHexToWif
} from '@/utils/bitcoin'

function makeKey(overrides: Partial<Key> = {}): Key {
  return {
    creationType: 'generateMnemonic',
    index: 0,
    iv: '',
    scriptVersion: 'P2WPKH',
    secret: '',
    ...overrides
  }
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    addresses: [],
    createdAt: new Date('2024-01-01'),
    id: 'acc-1',
    keyCount: 1,
    keys: [makeKey()],
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
    utxos: [],
    ...overrides
  }
}

function makeAddress(overrides: Partial<Address> = {}): Address {
  return {
    address: 'bc1qplaceholder',
    label: '',
    summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
    transactions: [],
    utxos: [],
    ...overrides
  }
}

describe('bitcoin utils', () => {
  describe('isBitcoinAddress', () => {
    it('should return a valid bitcoin address', () => {
      expect(
        isBitcoinAddress('myqtdq5wcy9vcm6z2muxla0y0eg94h06jgkcqnhhy4f')
      ).toBeFalsy()
      expect(
        isBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')
      ).toBeTruthy() // P2PKH address
      expect(
        isBitcoinAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')
      ).toBeTruthy() // P2SH address
      expect(
        isBitcoinAddress('bc1q8d968eg8ua3dk8mkql9d0vj35nzplsd4zmulus')
      ).toBeTruthy() // Bech32 address
      expect(
        isBitcoinAddress('tb1qlj64u6fqutr0xue85kl55fx0gt4m4urun25p7q')
      ).toBeTruthy() // Testnet Bech32 address
    })

    it('should validate regtest addresses', () => {
      expect(
        isBitcoinAddress('bcrt1q6rhpng9evdsfnn833a4f4vej0asu6dk5srld6x')
      ).toBeTruthy() // Regtest Bech32 address
    })
  })

  describe('isBip21', () => {
    it('should return true for valid BIP21 URI', () => {
      expect(
        isBip21('bitcoin:bc1qrc9ty0xfv908ja5r6xmzpnnr2ug6sfu0tl8j26')
      ).toBeTruthy()
    })

    it('should return true for BIP21 URI with amount', () => {
      expect(
        isBip21(
          'bitcoin:bc1qrc9ty0xfv908ja5r6xmzpnnr2ug6sfu0tl8j26?amount=0.001'
        )
      ).toBeTruthy()
    })

    it('should return true for plain valid address', () => {
      expect(isBip21('bc1qs5g58y64vzls986hnrz3atj6p2tcdqqgvu5g5c')).toBeTruthy()
    })

    it('should return false for invalid content', () => {
      expect(isBip21('invalid-content')).toBeFalsy()
    })

    it('should return false for empty string', () => {
      expect(isBip21('')).toBeFalsy()
    })
  })

  describe('bip21decode', () => {
    it('should decode a valid bitcoin address', () => {
      const result = bip21decode('bc1qs5g58y64vzls986hnrz3atj6p2tcdqqgvu5g5c')
      expect(result).toBe('bc1qs5g58y64vzls986hnrz3atj6p2tcdqqgvu5g5c')
    })

    it('should decode a valid BIP21 URI', () => {
      const uri =
        'bitcoin:bc1qrc9ty0xfv908ja5r6xmzpnnr2ug6sfu0tl8j26?amount=0.02587175'
      const result = bip21decode(uri)
      expect(result).toStrictEqual({
        address: 'bc1qrc9ty0xfv908ja5r6xmzpnnr2ug6sfu0tl8j26',
        options: {
          amount: 0.02587175,
          label: undefined,
          message: undefined
        }
      })
    })

    it('should decode BIP21 URI with label', () => {
      const uri =
        'bitcoin:bc1qrc9ty0xfv908ja5r6xmzpnnr2ug6sfu0tl8j26?amount=0.001&label=Test'
      const result = bip21decode(uri)
      expect(result).toMatchObject({
        address: 'bc1qrc9ty0xfv908ja5r6xmzpnnr2ug6sfu0tl8j26',
        options: {
          amount: 0.001,
          label: 'Test'
        }
      })
    })

    it('should return undefined for invalid address', () => {
      expect(bip21decode('bc1qinvalidaddress1234567890')).toBeUndefined()
    })

    it('should return undefined for empty string', () => {
      expect(bip21decode('')).toBeUndefined()
    })
  })

  describe('getAddressDerivationPath', () => {
    it('returns the address own derivationPath when already set', () => {
      const account = makeAccount()
      const address = makeAddress({
        derivationPath: "m/84'/0'/0'/0/7",
        index: 3,
        keychain: 'external'
      })
      expect(getAddressDerivationPath(account, address)).toBe("m/84'/0'/0'/0/7")
    })

    it('reconstructs the path for an external address, including the change level', () => {
      const account = makeAccount()
      const address = makeAddress({ index: 3, keychain: 'external' })
      // Regression test for a bug where the reconstructed path omitted the
      // change level entirely (produced "84'/0'/0'/3" instead of
      // "84'/0'/0'/0/3"), deriving a completely unrelated key.
      expect(getAddressDerivationPath(account, address)).toBe("84'/0'/0'/0/3")
    })

    it('reconstructs the path for an internal (change) address', () => {
      const account = makeAccount()
      const address = makeAddress({ index: 2, keychain: 'internal' })
      expect(getAddressDerivationPath(account, address)).toBe("84'/0'/0'/1/2")
    })

    it('distinguishes external and internal addresses at the same index', () => {
      const account = makeAccount()
      const external = getAddressDerivationPath(
        account,
        makeAddress({ index: 5, keychain: 'external' })
      )
      const internal = getAddressDerivationPath(
        account,
        makeAddress({ index: 5, keychain: 'internal' })
      )
      expect(external).not.toBe(internal)
    })

    it('reconstructs the correct path for index 0 (not just later indices)', () => {
      const account = makeAccount()
      const address = makeAddress({ index: 0, keychain: 'external' })
      expect(getAddressDerivationPath(account, address)).toBe("84'/0'/0'/0/0")
    })

    it('returns empty string when index or keychain is missing', () => {
      const account = makeAccount()
      expect(getAddressDerivationPath(account, makeAddress())).toBe('')
    })
  })

  describe('privateKeyHexToWif', () => {
    // Ground truth independently computed with the `wif` npm package for
    // the same private key used in tests/unit/utils/addressKeyDerivation.test.ts
    // (m/84'/0'/0'/0/3 of the standard BIP39 test mnemonic).
    const privateKeyHex =
      '2048fa6e298fcac0e786e4bacc01b27579aed37b0b9e0dcb31e114d6f91d6392'

    it('encodes a mainnet compressed WIF', () => {
      expect(privateKeyHexToWif(privateKeyHex, 'bitcoin')).toBe(
        'KxJU9SA93qW5aCvjGsSgP5VeJZJEH9mncd7xKiwvWS17Zj7uJfYc'
      )
    })

    it('encodes a testnet compressed WIF', () => {
      expect(privateKeyHexToWif(privateKeyHex, 'testnet')).toBe(
        'cNfTcM9zUuCLjePzfHFokPzhvnbdwbsUgfGRS9QS1Yf7pUCgcyRD'
      )
    })

    it('encodes signet using the testnet WIF prefix', () => {
      expect(privateKeyHexToWif(privateKeyHex, 'signet')).toBe(
        privateKeyHexToWif(privateKeyHex, 'testnet')
      )
    })
  })
})
