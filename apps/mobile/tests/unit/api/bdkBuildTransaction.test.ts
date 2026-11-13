import { BdkTxBuilder, BdkWallet, Network } from 'react-native-bdk-sdk'

import {
  buildPsbtWithRpcOrBdkWallet,
  hasInputsMissingFromWallet
} from '@/api/bdk'
import { SEQUENCE_LOCKTIME_NO_RBF, SEQUENCE_RBF } from '@/constants/btc'
import type { Account } from '@/types/models/Account'
import type { Server } from '@/types/settings/blockchain'

// Same module-graph stubs as bdkRpc.test.ts: @/utils/bip39 and @/api/electrum
// cannot load under Jest, and nothing here exercises them.
jest.mock<typeof import('@/utils/bip39')>('@/utils/bip39', () => ({
  detectElectrumSeed: jest.fn(() => null),
  getPrivateDescriptorFromElectrumMnemonic: jest.fn(),
  getPrivateDescriptorFromMnemonic: jest.fn(),
  mnemonicToSeed: jest.fn(() => new Uint8Array())
}))

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  default: {} as unknown as typeof import('@/api/electrum').default
}))

const SERVER: Server = {
  backend: 'esplora',
  name: 'Mempool',
  network: 'signet',
  url: 'https://mempool.space/signet/api'
}
const PAYMENT = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'

function lastTxBuilder() {
  return jest.mocked(BdkTxBuilder).mock.results.at(-1)?.value
}

function build(rbf: boolean) {
  const wallet = new BdkWallet('', undefined, Network.Signet, '')
  return buildPsbtWithRpcOrBdkWallet(wallet, SERVER, undefined, {
    fee: 300,
    inputs: [
      { keychain: 'external', txid: 'aa'.repeat(32), value: 50_000, vout: 1 }
    ],
    options: { rbf },
    outputs: [{ amount: 40_000, label: '', localId: 'out-1', to: PAYMENT }]
  })
}

describe('buildPsbtWithRpcOrBdkWallet sequence', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('signals RBF when it is on', async () => {
    await build(true)

    expect(lastTxBuilder().setExactSequence).toHaveBeenCalledWith(SEQUENCE_RBF)
  })

  it('sets a non-RBF sequence when it is off instead of the bdk default', async () => {
    await build(false)

    const txBuilder = lastTxBuilder()
    expect(txBuilder.setExactSequence).toHaveBeenCalledWith(
      SEQUENCE_LOCKTIME_NO_RBF
    )
    expect(txBuilder.enableRbf).not.toHaveBeenCalled()
  })
})

describe('hasInputsMissingFromWallet', () => {
  const INPUT = {
    keychain: 'external' as const,
    txid: 'bb'.repeat(32),
    value: 20_000,
    vout: 1
  }
  const CORE_SERVER: Server = {
    backend: 'rpc',
    name: 'Node',
    network: 'signet',
    rpcCredentials: { password: 'pass', username: 'user' },
    url: 'http://127.0.0.1:38332'
  }

  function walletHolding(isHeld: boolean) {
    const wallet = new BdkWallet('', undefined, Network.Signet, '')
    jest
      .mocked(wallet.getUtxo)
      .mockReturnValue(isHeld ? { outpoint: INPUT } : undefined)
    return wallet
  }

  it('flags an input the BDK wallet has not synced yet', () => {
    expect(
      hasInputsMissingFromWallet(walletHolding(false), SERVER, undefined, [
        INPUT
      ])
    ).toBe(true)
  })

  it('passes inputs the BDK wallet holds', () => {
    expect(
      hasInputsMissingFromWallet(walletHolding(true), SERVER, undefined, [
        INPUT
      ])
    ).toBe(false)
  })

  it('leaves sends built by a Bitcoin Core wallet alone', () => {
    const account: Account = {
      addresses: [],
      createdAt: new Date('2026-01-01'),
      id: 'acc-1',
      keyCount: 1,
      keys: [],
      keysRequired: 1,
      labels: {},
      name: 'Core',
      network: 'signet',
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
    expect(
      hasInputsMissingFromWallet(walletHolding(false), CORE_SERVER, account, [
        INPUT
      ])
    ).toBe(false)
  })
})
