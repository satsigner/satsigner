import {
  estimateArkLightningReceiveFee,
  estimateArkSendOnchainFee,
  fetchArkLightningReceive,
  sendArkOnchain
} from '@/api/ark'
import { reserveFreshReceiveAddress } from '@/services/accountReceiveAddress'
import { advanceArkSwapJobs } from '@/services/arkSwap'
import { useAccountsStore } from '@/store/accounts'
import { useArkStore } from '@/store/ark'
import { useArkSwapsStore } from '@/store/arkSwaps'
import { type Account } from '@/types/models/Account'
import { type ArkLightningToOnchainJob } from '@/types/models/ArkSwap'

jest.mock<typeof import('@/api/ark')>('@/api/ark', () => ({
  estimateArkLightningReceiveFee: jest.fn(),
  estimateArkSendOnchainFee: jest.fn(),
  fetchArkLightningReceive: jest.fn(),
  sendArkOnchain: jest.fn()
}))
jest.mock<typeof import('@/services/accountReceiveAddress')>(
  '@/services/accountReceiveAddress',
  () => ({
    peekFreshReceiveAddress: jest.fn(),
    reserveFreshReceiveAddress: jest.fn()
  })
)
jest.mock<typeof import('@/services/arkBoardFunding')>(
  '@/services/arkBoardFunding',
  () => ({
    prepareArkBoardFromAccount: jest.fn()
  })
)
jest.mock<typeof import('@/services/arkWallet')>(
  '@/services/arkWallet',
  () => ({
    ensureArkWalletOpen: jest.fn()
  })
)

const ARK_ACCOUNT_ID = 'ark-1'
const DESTINATION_ID = 'wallet-1'
const JOB_ID = 'swap-1'
const PAYOUT_ADDRESS = 'tb1qzyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3t3jqk5'
const RECEIVED_SATS = 20_000
const PAYOUT_TXID = 'a'.repeat(64)

function feeEstimate(feeSats: number) {
  return {
    feeSats,
    grossAmountSats: RECEIVED_SATS,
    netAmountSats: RECEIVED_SATS - feeSats,
    vtxoIdsSpent: []
  }
}

function awaitingPaymentJob(): ArkLightningToOnchainJob {
  return {
    amountSats: RECEIVED_SATS,
    arkAccountId: ARK_ACCOUNT_ID,
    createdAt: 0,
    destinationAccountId: DESTINATION_ID,
    id: JOB_ID,
    invoice: 'lntbs1invoice',
    invoiceExpiresAt: Number.MAX_SAFE_INTEGER,
    kind: 'lightningToOnchain',
    paymentHash: 'hash-1',
    status: 'awaitingPayment',
    updatedAt: 0
  }
}

function destinationAccount(): Account {
  return {
    addresses: [],
    createdAt: new Date(0),
    displayIndex: 0,
    id: DESTINATION_ID,
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

function removeJob() {
  useArkSwapsStore.getState().removeJob(JOB_ID)
}

describe('advanceArkSwapJobs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useArkStore.getState().clearAllData()
    useArkStore.getState().addAccount({
      bitcoinAccountId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      id: ARK_ACCOUNT_ID,
      name: 'Ark',
      network: 'signet',
      serverId: 'second'
    })
    useAccountsStore.setState({ accounts: [destinationAccount()] })
    useArkSwapsStore.getState().clearAllData()
    useArkSwapsStore.getState().saveJob(awaitingPaymentJob())
    jest.mocked(fetchArkLightningReceive).mockResolvedValue({
      amountSats: RECEIVED_SATS,
      invoice: 'lntbs1invoice',
      paymentHash: 'hash-1',
      settled: true,
      state: 'settled'
    })
    jest.mocked(reserveFreshReceiveAddress).mockResolvedValue(PAYOUT_ADDRESS)
    jest
      .mocked(estimateArkLightningReceiveFee)
      .mockResolvedValue(feeEstimate(100))
    jest.mocked(estimateArkSendOnchainFee).mockResolvedValue(feeEstimate(300))
    jest.mocked(sendArkOnchain).mockResolvedValue(PAYOUT_TXID)
  })

  it('sends the payout of a settled receive', async () => {
    await advanceArkSwapJobs()

    expect(sendArkOnchain).toHaveBeenCalledWith(
      'second',
      ARK_ACCOUNT_ID,
      PAYOUT_ADDRESS,
      RECEIVED_SATS - 100 - 300
    )
    expect(useArkSwapsStore.getState().jobs).toMatchObject([
      { id: JOB_ID, status: 'completed', txid: PAYOUT_TXID }
    ])
  })

  it('does not send the payout of a job removed while it was advanced', async () => {
    jest.mocked(estimateArkSendOnchainFee).mockImplementation(() => {
      removeJob()
      return Promise.resolve(feeEstimate(300))
    })

    await advanceArkSwapJobs()

    expect(sendArkOnchain).not.toHaveBeenCalled()
    expect(useArkSwapsStore.getState().jobs).toStrictEqual([])
  })

  it('does not bring back a job removed while its payout was sent', async () => {
    jest.mocked(sendArkOnchain).mockImplementation(() => {
      removeJob()
      return Promise.resolve(PAYOUT_TXID)
    })

    await advanceArkSwapJobs()

    expect(sendArkOnchain).toHaveBeenCalledTimes(1)
    expect(useArkSwapsStore.getState().jobs).toStrictEqual([])
  })
})
