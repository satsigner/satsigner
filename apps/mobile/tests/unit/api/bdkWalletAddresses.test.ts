import {
  BdkWallet,
  KeychainKind,
  Network,
  addressFromScript
} from 'react-native-bdk-sdk'

import { getWalletAddresses, getWalletOverview } from '@/api/bdkWalletMappers'
import { MS_PER_SECOND } from '@/constants/time'

const RECEIVE_ADDRESS = 'wif-receive'
const COMPANION_ADDRESS = 'wif-companion'
const P2WPKH_SCRIPT_HEX = `0014${'00'.repeat(20)}`

// BDK answers every index of a descriptor without a wildcard with its one
// script at index 0.
function singleScriptWallet() {
  const wallet = new BdkWallet('', undefined, Network.Testnet, '')
  wallet.peekAddress.mockImplementation((keychain: KeychainKind) => ({
    address:
      keychain === KeychainKind.External ? RECEIVE_ADDRESS : COMPANION_ADDRESS,
    index: 0,
    keychain
  }))
  return wallet
}

function receiveTxDetails(address: string) {
  return {
    confirmationBlockTime: undefined,
    fee: 0,
    inputs: [],
    locktime: 0,
    outputs: [{ address, scriptPubkeyHex: P2WPKH_SCRIPT_HEX, value: 1000 }],
    received: 1000,
    sent: 0,
    txid: 'aa'.repeat(32),
    version: 2
  }
}

function addressesByKeychain(
  addresses: { address: string; keychain?: string }[]
) {
  return addresses.map(({ address, keychain }) => ({ address, keychain }))
}

describe('wallet addresses of a descriptor without a wildcard', () => {
  it('lists the one address of each keychain once', () => {
    const wallet = singleScriptWallet()

    expect(
      addressesByKeychain(getWalletAddresses(wallet, Network.Testnet))
    ).toStrictEqual([
      { address: RECEIVE_ADDRESS, keychain: 'external' },
      { address: COMPANION_ADDRESS, keychain: 'internal' }
    ])
  })

  it('finishes the overview when the one address has been used', () => {
    const wallet = singleScriptWallet()
    wallet.transactions.mockReturnValue([receiveTxDetails(RECEIVE_ADDRESS)])

    const overview = getWalletOverview(wallet, Network.Testnet, 20)

    expect(addressesByKeychain(overview.addresses)).toStrictEqual([
      { address: RECEIVE_ADDRESS, keychain: 'external' },
      { address: COMPANION_ADDRESS, keychain: 'internal' }
    ])
    expect(overview.summary.numberOfAddresses).toBe(1)
  })

  it('does not scan for an output address the wallet cannot derive', () => {
    const wallet = singleScriptWallet()
    wallet.transactions.mockReturnValue([receiveTxDetails('stranger')])

    const overview = getWalletOverview(wallet, Network.Testnet, 20)

    expect(overview.addresses).toHaveLength(2)
    expect(wallet.peekAddress.mock.calls.length).toBeLessThan(10)
  })
})

describe('wallet overview lookups', () => {
  const TXID = 'bb'.repeat(32)
  const CONFIRMED_AT_SECONDS = 1_700_000_000
  const LATER_TXID = 'cc'.repeat(32)
  const LATER_CONFIRMED_AT_SECONDS = 1_700_000_600

  function confirmedTxDetails(txid = TXID, timestamp = CONFIRMED_AT_SECONDS) {
    return {
      ...receiveTxDetails(RECEIVE_ADDRESS),
      confirmationBlockTime: { height: 100, timestamp },
      txid
    }
  }

  function localOutput(vout: number, scriptPubkeyHex: string, txid = TXID) {
    return {
      isSpent: false,
      keychain: KeychainKind.External,
      outpoint: { txid, vout },
      txout: { scriptPubkeyHex, value: 1000 }
    }
  }

  it('takes the transaction address from its first unspent output', () => {
    const wallet = singleScriptWallet()
    const firstScript = `0014${'11'.repeat(20)}`
    wallet.transactions.mockReturnValue([confirmedTxDetails()])
    wallet.listUnspent.mockReturnValue([
      localOutput(0, firstScript),
      localOutput(1, `0014${'22'.repeat(20)}`)
    ])
    jest.mocked(addressFromScript).mockClear()

    const overview = getWalletOverview(wallet, Network.Testnet, 20)

    expect(jest.mocked(addressFromScript).mock.calls[0][0]).toBe(firstScript)
    expect(overview.transactions[0].address).toBe('mock-address')
  })

  it('dates each unspent output with its confirmed transaction', () => {
    const wallet = singleScriptWallet()
    wallet.transactions.mockReturnValue([
      confirmedTxDetails(),
      confirmedTxDetails(LATER_TXID, LATER_CONFIRMED_AT_SECONDS)
    ])
    wallet.listUnspent.mockReturnValue([
      localOutput(0, P2WPKH_SCRIPT_HEX, LATER_TXID),
      localOutput(0, P2WPKH_SCRIPT_HEX)
    ])

    const overview = getWalletOverview(wallet, Network.Testnet, 20)

    expect(overview.utxos.map((utxo) => utxo.timestamp)).toStrictEqual([
      new Date(LATER_CONFIRMED_AT_SECONDS * MS_PER_SECOND),
      new Date(CONFIRMED_AT_SECONDS * MS_PER_SECOND)
    ])
  })
})
