import { UNSET_OUTPUT_AMOUNT_SATS } from '@/constants/btc'
import {
  getChatBitcoinPayAccounts,
  startChatBitcoinRequestPay
} from '@/services/chatBitcoinRequestPay'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import type { Account } from '@/types/models/Account'
import type { ChatBitcoinRequest } from '@/utils/chatPaymentRequests'

const ADDRESS = 'tb1qzyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3t3jqk5'
const IO_PREVIEW = '/signer/bitcoin/account/[id]/signAndSend/ioPreview'

function account(id: string, network: Account['network']): Account {
  return {
    addresses: [],
    createdAt: new Date(0),
    displayIndex: 0,
    id,
    keyCount: 1,
    keys: [{ creationType: 'importExtendedPub', index: 0, iv: '', secret: '' }],
    keysRequired: 1,
    labels: {},
    name: id,
    network,
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
    transactions: [],
    utxos: []
  }
}

function request(amountSats: number): ChatBitcoinRequest {
  return {
    address: ADDRESS,
    amountSats,
    hasLightningFallback: false,
    kind: 'bitcoin',
    label: 'Pizza night',
    message: '',
    network: 'signet',
    uri: `bitcoin:${ADDRESS}`
  }
}

describe('getChatBitcoinPayAccounts', () => {
  it('only offers accounts on the request network', () => {
    const accounts = [
      account('main', 'bitcoin'),
      account('sig', 'signet'),
      account('test', 'testnet')
    ]
    expect(
      getChatBitcoinPayAccounts(accounts, { network: 'signet' }).map(
        ({ id }) => id
      )
    ).toStrictEqual(['sig'])
  })

  it('offers nothing when the network is unknown', () => {
    expect(
      getChatBitcoinPayAccounts([account('main', 'bitcoin')], {
        network: null
      })
    ).toStrictEqual([])
  })
})

describe('startChatBitcoinRequestPay', () => {
  beforeEach(() => {
    useBlockchainStore.getState().setSelectedNetwork('bitcoin')
    useTransactionBuilderStore.getState().clearTransaction()
  })

  it('drafts the requested output and opens the preview, without sending', () => {
    const navigate = jest.fn()
    startChatBitcoinRequestPay(
      account('sig', 'signet'),
      request(25_000),
      navigate
    )

    const builder = useTransactionBuilderStore.getState()
    expect(useBlockchainStore.getState().selectedNetwork).toBe('signet')
    expect(builder.accountId).toBe('sig')
    expect(builder.outputs).toHaveLength(1)
    expect(builder.outputs[0]).toMatchObject({
      amount: 25_000,
      label: 'Pizza night',
      to: ADDRESS
    })
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: IO_PREVIEW })
    )
  })

  it('leaves the amount for the user to fill when the URI has none', () => {
    startChatBitcoinRequestPay(account('sig', 'signet'), request(0), jest.fn())
    expect(useTransactionBuilderStore.getState().outputs[0]?.amount).toBe(
      UNSET_OUTPUT_AMOUNT_SATS
    )
  })
})
