import { prefillSendFromAccount } from '@/services/transactionBuilderPrefill'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account } from '@/types/models/Account'

jest.mock<typeof import('@/utils/contentProcessor')>(
  '@/utils/contentProcessor',
  () => ({
    autoSelectUtxos: jest.fn()
  })
)

const ACCOUNT_ID = 'wallet-1'
const ADDRESS = 'tb1qzyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3t3jqk5'
const AMOUNT_SATS = 25_000

function signetAccount(): Account {
  return {
    addresses: [],
    createdAt: new Date(0),
    displayIndex: 0,
    id: ACCOUNT_ID,
    keyCount: 1,
    keys: [{ creationType: 'importExtendedPub', index: 0, iv: '', secret: '' }],
    keysRequired: 1,
    labels: {},
    name: 'Savings',
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
    transactions: [],
    utxos: []
  }
}

describe('prefillSendFromAccount', () => {
  beforeEach(() => {
    useBlockchainStore.getState().setSelectedNetwork('bitcoin')
    useTransactionBuilderStore.getState().clearTransaction()
  })

  it('switches the selected network to the funding account network', () => {
    prefillSendFromAccount({
      account: signetAccount(),
      address: ADDRESS,
      amountSats: AMOUNT_SATS,
      feeRateSatPerVb: 2,
      label: 'Board'
    })

    expect(useBlockchainStore.getState().selectedNetwork).toBe('signet')
    expect(useTransactionBuilderStore.getState().accountId).toBe(ACCOUNT_ID)
  })
})
