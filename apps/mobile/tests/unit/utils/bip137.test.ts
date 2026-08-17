import { type Account } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { signMessageBip137, verifyMessageBip137 } from '@/utils/bip137'
import { getAddressDerivationPath } from '@/utils/bitcoin'
import { getAddressKeyPair } from '@/utils/key'

import { bip137Vectors } from './bip137_samples'

const privateKey = Buffer.from(bip137Vectors.privateKeyHex, 'hex')
const [, helloWorldCase] = bip137Vectors.cases

const REGRESSION_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
// m/84'/0'/0'/0/3 for REGRESSION_MNEMONIC.
const REGRESSION_ADDRESS = 'bc1qgl5vlg0zdl7yvprgxj9fevsc6q6x5dmcyk3cn3'

const regressionAccount: Account = {
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
const regressionAddress: Address = {
  address: REGRESSION_ADDRESS,
  index: 3,
  keychain: 'external',
  label: '',
  scriptVersion: 'P2WPKH',
  summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
  transactions: [],
  utxos: []
}

describe('bip137 utils', () => {
  describe('signMessageBip137', () => {
    for (const { message, p2pkh, p2shP2wpkh, p2wpkh } of bip137Vectors.cases) {
      it(`produces the reference signature for p2pkh (message: ${JSON.stringify(message)})`, () => {
        expect(signMessageBip137(privateKey, message, 'p2pkh')).toBe(p2pkh)
      })

      it(`produces the reference signature for p2sh-p2wpkh (message: ${JSON.stringify(message)})`, () => {
        expect(signMessageBip137(privateKey, message, 'p2sh-p2wpkh')).toBe(
          p2shP2wpkh
        )
      })

      it(`produces the reference signature for p2wpkh (message: ${JSON.stringify(message)})`, () => {
        expect(signMessageBip137(privateKey, message, 'p2wpkh')).toBe(p2wpkh)
      })
    }
  })

  describe('verifyMessageBip137', () => {
    for (const { message, p2pkh, p2shP2wpkh, p2wpkh } of bip137Vectors.cases) {
      it(`verifies a valid p2pkh signature (message: ${JSON.stringify(message)})`, () => {
        expect(
          verifyMessageBip137(
            bip137Vectors.addresses.p2pkh,
            message,
            p2pkh,
            'bitcoin'
          )
        ).toBe(true)
      })

      it(`verifies a valid p2sh-p2wpkh signature (message: ${JSON.stringify(message)})`, () => {
        expect(
          verifyMessageBip137(
            bip137Vectors.addresses.p2shP2wpkh,
            message,
            p2shP2wpkh,
            'bitcoin'
          )
        ).toBe(true)
      })

      it(`verifies a valid p2wpkh signature (message: ${JSON.stringify(message)})`, () => {
        expect(
          verifyMessageBip137(
            bip137Vectors.addresses.p2wpkh,
            message,
            p2wpkh,
            'bitcoin'
          )
        ).toBe(true)
      })
    }

    it('rejects a signature for the wrong message', () => {
      const { p2pkh } = helloWorldCase
      expect(
        verifyMessageBip137(
          bip137Vectors.addresses.p2pkh,
          'a different message',
          p2pkh,
          'bitcoin'
        )
      ).toBe(false)
    })

    it('rejects a signature for the wrong address', () => {
      const { message, p2pkh } = helloWorldCase
      expect(
        verifyMessageBip137(
          bip137Vectors.addresses.p2wpkh,
          message,
          p2pkh,
          'bitcoin'
        )
      ).toBe(false)
    })

    it('rejects a tampered signature', () => {
      const { message, p2pkh } = helloWorldCase
      const tampered = `${p2pkh.slice(0, -4)}AAAA`
      expect(
        verifyMessageBip137(
          bip137Vectors.addresses.p2pkh,
          message,
          tampered,
          'bitcoin'
        )
      ).toBe(false)
    })

    it('rejects a malformed base64 signature', () => {
      expect(
        verifyMessageBip137(
          bip137Vectors.addresses.p2pkh,
          'test',
          'not-base64!!',
          'bitcoin'
        )
      ).toBe(false)
    })
  })

  // Regression: getAddressDerivationPath used to omit the change level,
  // deriving an unrelated key, so a freshly-signed message failed verify.
  describe('sign-then-verify round trip against a real derived key', () => {
    it('a message signed from a derived address key verifies against that same address', () => {
      const derivationPath = getAddressDerivationPath(
        regressionAccount,
        regressionAddress
      )
      const keyPair = getAddressKeyPair(
        { mnemonic: REGRESSION_MNEMONIC },
        { ...regressionAddress, derivationPath },
        regressionAccount.network
      )
      if (!keyPair) {
        throw new Error('expected a key pair')
      }

      const signature = signMessageBip137(
        Buffer.from(keyPair.privateKey, 'hex'),
        'hello from satsigner',
        'p2wpkh'
      )

      expect(
        verifyMessageBip137(
          REGRESSION_ADDRESS,
          'hello from satsigner',
          signature,
          'bitcoin'
        )
      ).toBe(true)
    })
  })
})
