import { BdkWallet, Network } from 'react-native-bdk-sdk'

import { UNUSED_INTERNAL_ADDRESSES_NEEDED } from '@/constants/btc'
import type { Account, Key } from '@/types/models/Account'
import type { Transaction } from '@/types/models/Transaction'
import { getUnusedInternalAddresses } from '@/utils/unusedInternalAddresses'

const MAX_INTERNAL_ADDRESS_SCAN = 1000

function makeKey(overrides: Partial<Key> = {}): Key {
  return {
    creationType: 'generateMnemonic',
    index: 0,
    iv: '',
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

function makeTransactionWithOutputs(addresses: string[]): Transaction {
  return {
    blockHeight: 0,
    fee: 0,
    id: 'tx-1',
    label: '',
    lockTime: 0,
    lockTimeEnabled: false,
    prices: {},
    received: 0,
    sent: 0,
    timestamp: new Date('2024-01-01'),
    type: 'send',
    vin: [],
    vout: addresses.map((address) => ({
      address,
      script: '',
      value: 1000
    }))
  }
}

function makeWallet() {
  const wallet = new BdkWallet('', undefined, Network.Testnet, '')
  wallet.peekAddress.mockImplementation((keychain: unknown, index: number) => ({
    address: `internal-${index}`,
    index,
    keychain
  }))
  return wallet
}

describe('getUnusedInternalAddresses', () => {
  it('returns empty addresses when account or wallet is missing', () => {
    const empty = {
      changeAddress: '',
      decoyAddress: '',
      secondChangeAddress: ''
    }

    expect(getUnusedInternalAddresses()).toStrictEqual(empty)
    expect(getUnusedInternalAddresses(makeAccount())).toStrictEqual(empty)
    expect(getUnusedInternalAddresses(undefined, makeWallet())).toStrictEqual(
      empty
    )
  })

  it('returns the first unused internal addresses in order', () => {
    const result = getUnusedInternalAddresses(makeAccount(), makeWallet())

    expect(result).toStrictEqual({
      changeAddress: 'internal-0',
      decoyAddress: 'internal-2',
      secondChangeAddress: 'internal-1'
    })
  })

  it('skips addresses already used in transaction outputs', () => {
    const account = makeAccount({
      transactions: [
        makeTransactionWithOutputs(['internal-0', 'internal-2', 'other'])
      ]
    })

    const result = getUnusedInternalAddresses(account, makeWallet())

    expect(result).toStrictEqual({
      changeAddress: 'internal-1',
      decoyAddress: 'internal-4',
      secondChangeAddress: 'internal-3'
    })
  })

  it('stops peeking once enough unused addresses are found', () => {
    const wallet = makeWallet()

    getUnusedInternalAddresses(makeAccount(), wallet)

    expect(wallet.peekAddress).toHaveBeenCalledTimes(
      UNUSED_INTERNAL_ADDRESSES_NEEDED
    )
  })

  it('gives up after scanning the maximum number of addresses', () => {
    const wallet = makeWallet()
    const usedAddresses = Array.from(
      { length: MAX_INTERNAL_ADDRESS_SCAN },
      (_, index) => `internal-${index}`
    )
    const account = makeAccount({
      transactions: [makeTransactionWithOutputs(usedAddresses)]
    })

    const result = getUnusedInternalAddresses(account, wallet)

    expect(result).toStrictEqual({
      changeAddress: '',
      decoyAddress: '',
      secondChangeAddress: ''
    })
    expect(wallet.peekAddress).toHaveBeenCalledTimes(MAX_INTERNAL_ADDRESS_SCAN)
  })
})
