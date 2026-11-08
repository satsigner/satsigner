import { BdkWallet, Network } from 'react-native-bdk-sdk'

import {
  peekFreshReceiveAddress,
  reserveFreshReceiveAddress,
  reserveReceiveAddressIfFresh
} from '@/services/accountReceiveAddress'
import { useWalletsStore } from '@/store/wallets'
import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'

function loadRangedWallet(accountId: string) {
  const wallet = new BdkWallet('', undefined, Network.Signet, '')
  wallet.peekAddress.mockImplementation((keychain: unknown, index: number) => ({
    address: `addr-${index}`,
    index,
    keychain
  }))
  useWalletsStore.getState().addAccountWallet(accountId, wallet)
}

function makeAccount(id: string, paidAddresses: string[] = []): Account {
  const transactions: Transaction[] = paidAddresses.map((address) => ({
    id: `tx-${address}`,
    lockTimeEnabled: false,
    prices: {},
    received: 0,
    sent: 0,
    type: 'receive',
    vin: [],
    vout: [{ address, script: [], value: 1000 }]
  }))
  return {
    addresses: [],
    createdAt: new Date(0),
    id,
    keyCount: 1,
    keys: [],
    keysRequired: 1,
    labels: {},
    name: id,
    network: 'signet',
    nostr: {
      autoSync: false,
      commonNpub: '',
      commonNsec: '',
      dms: [],
      lastUpdated: new Date(0),
      relays: [],
      syncStart: new Date(0),
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
    transactions,
    utxos: []
  }
}

describe('fresh receive addresses', () => {
  it('skips addresses a known transaction pays', async () => {
    loadRangedWallet('acc-paid')
    const account = makeAccount('acc-paid', ['addr-0', 'addr-1'])
    await expect(peekFreshReceiveAddress(account)).resolves.toBe('addr-2')
  })

  it('peeking does not reserve the address', async () => {
    loadRangedWallet('acc-peek')
    const account = makeAccount('acc-peek')
    await expect(peekFreshReceiveAddress(account)).resolves.toBe('addr-0')
    await expect(peekFreshReceiveAddress(account)).resolves.toBe('addr-0')
  })

  it('never hands the same address to two sends, even concurrent ones', async () => {
    loadRangedWallet('acc-reserve')
    const account = makeAccount('acc-reserve')
    const addresses = await Promise.all([
      reserveFreshReceiveAddress(account),
      reserveFreshReceiveAddress(account)
    ])
    expect(addresses).toStrictEqual(['addr-0', 'addr-1'])
    await expect(peekFreshReceiveAddress(account)).resolves.toBe('addr-2')
  })

  it('reserves a peeked address that is still fresh', async () => {
    loadRangedWallet('acc-if-fresh')
    const account = makeAccount('acc-if-fresh')
    const drafted = await peekFreshReceiveAddress(account)
    await expect(reserveReceiveAddressIfFresh(account, drafted)).resolves.toBe(
      true
    )
    await expect(peekFreshReceiveAddress(account)).resolves.toBe('addr-1')
  })

  it('leaves the next address free when the peeked one was taken', async () => {
    loadRangedWallet('acc-taken')
    const account = makeAccount('acc-taken')
    const drafted = await peekFreshReceiveAddress(account)
    await reserveFreshReceiveAddress(account)
    await expect(reserveReceiveAddressIfFresh(account, drafted)).resolves.toBe(
      false
    )
    await expect(peekFreshReceiveAddress(account)).resolves.toBe('addr-1')
  })

  it('skips addresses reserved before this session', async () => {
    loadRangedWallet('acc-earlier')
    const account = makeAccount('acc-earlier')
    await expect(
      reserveFreshReceiveAddress(account, ['addr-0', 'addr-1'])
    ).resolves.toBe('addr-2')
  })
})
