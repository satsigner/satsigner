import * as bitcoinjs from 'bitcoinjs-lib'

import { recordSentTransaction } from '@/services/sentTransaction'
import { useAccountsStore } from '@/store/accounts'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account } from '@/types/models/Account'

const ACCOUNT_ID = 'wallet-1'
const TXID = 'c'.repeat(64)
const PAYEE = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
const OTHER = 'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7'

// The sent transaction pays someone else first: the payee is vout 1.
function sentTransactionHex() {
  const network = bitcoinjs.networks.testnet
  const transaction = new bitcoinjs.Transaction()
  transaction.addInput(new Uint8Array(32), 0)
  transaction.addOutput(bitcoinjs.address.toOutputScript(OTHER, network), 500n)
  transaction.addOutput(bitcoinjs.address.toOutputScript(PAYEE, network), 4000n)
  return transaction.toHex()
}

function signetAccount(): Account {
  return {
    addresses: [],
    createdAt: new Date(0),
    id: ACCOUNT_ID,
    keyCount: 1,
    keys: [],
    keysRequired: 1,
    labels: {},
    name: 'Savings',
    network: 'signet',
    policyType: 'singlesig',
    summary: {
      balance: 5000,
      numberOfAddresses: 0,
      numberOfTransactions: 0,
      numberOfUtxos: 1,
      satsInMempool: 0
    },
    syncStatus: 'synced',
    transactions: [],
    utxos: []
  }
}

function fillBuilder() {
  const builder = useTransactionBuilderStore.getState()
  builder.clearTransaction()
  builder.addInput({
    keychain: 'external',
    label: '',
    txid: 'a'.repeat(64),
    value: 5000,
    vout: 0
  })
  builder.addOutput({ amount: 4000, label: 'rent', to: PAYEE })
  builder.setFee(1000)
  builder.setSignedTx(sentTransactionHex())
}

describe('recordSentTransaction', () => {
  const importLabels = jest.fn(() => 0)
  const updateAccount = jest.fn()

  beforeEach(() => {
    importLabels.mockClear()
    updateAccount.mockClear()
    useAccountsStore.setState({
      accounts: [signetAccount()],
      importLabels,
      updateAccount
    })
    fillBuilder()
  })

  it('saves the labels and adds the transaction to the account', () => {
    recordSentTransaction(ACCOUNT_ID, TXID)

    expect(importLabels).toHaveBeenCalledWith(
      ACCOUNT_ID,
      expect.arrayContaining([
        { label: 'rent', ref: `${TXID}:1`, type: 'output' },
        { label: 'rent', ref: TXID, type: 'tx' }
      ])
    )
    expect(updateAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ACCOUNT_ID,
        transactions: [expect.objectContaining({ id: TXID, sent: 5000 })]
      })
    )
  })

  it('does not throw when saving the labels fails', () => {
    importLabels.mockImplementationOnce(() => {
      throw new Error('database is locked')
    })

    expect(() => recordSentTransaction(ACCOUNT_ID, TXID)).not.toThrow()
    expect(updateAccount).not.toHaveBeenCalled()
  })

  it('leaves an unknown account alone', () => {
    recordSentTransaction('missing', TXID)

    expect(updateAccount).not.toHaveBeenCalled()
  })
})
