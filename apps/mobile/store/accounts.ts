import { Descriptor, Wallet } from 'bdk-rn'
import { Network } from 'bdk-rn/lib/lib/enums'
import { produce } from 'immer'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getWalletData, getWalletFromDescriptor, syncWallet } from '@/api/bdk'
import { MempoolOracle } from '@/api/blockchain'
import { getBlockchainConfig } from '@/config/servers'
import mmkvStorage from '@/storage/mmkv'
import { type Account } from '@/types/models/Account'
import { Transaction } from '@/types/models/Transaction'
import { Utxo } from '@/types/models/Utxo'
import { formatTimestamp } from '@/utils/format'
import { getUtxoOutpoint } from '@/utils/utxo'

import { useBlockchainStore } from './blockchain'

type AccountsState = {
  accounts: Account[]
  tags: string[]
}

type AccountsAction = {
  getCurrentAccount: (name: string) => Account | undefined
  hasAccountWithName: (name: string) => boolean
  loadWalletFromDescriptor: (
    externalDescriptor: Descriptor,
    internalDescriptor: Descriptor
  ) => Promise<Wallet>
  syncWallet: (wallet: Wallet, account: Account) => Promise<Account>
  addAccount: (account: Account) => Promise<void>
  updateAccount: (account: Account) => Promise<void>
  deleteAccounts: () => void
  getTags: () => string[]
  setTags: (tags: string[]) => void
  getTx: (account: string, txid: string) => Transaction
  getUtxo: (account: string, txid: string, vout: number) => Utxo
  setTxLabel: (account: string, txid: string, label: string) => void
  setUtxoLabel: (
    account: string,
    txid: string,
    vout: number,
    label: string
  ) => void
}

const useAccountsStore = create<AccountsState & AccountsAction>()(
  persist(
    (set, get) => ({
      accounts: [],
      tags: [],
      getCurrentAccount: (name) => {
        return get().accounts.find((account) => account.name === name)
      },
      hasAccountWithName: (name) => {
        return !!get().accounts.find((account) => account.name === name)
      },
      loadWalletFromDescriptor: async (
        externalDescriptor,
        internalDescriptor
      ) => {
        const { network } = useBlockchainStore.getState()

        const wallet = getWalletFromDescriptor(
          externalDescriptor,
          internalDescriptor,
          network as Network
        )
        return wallet
      },
      syncWallet: async (wallet, account) => {
        const { backend, network, retries, stopGap, timeout, url } =
          useBlockchainStore.getState()
        const opts = { retries, stopGap, timeout }

        await syncWallet(
          wallet,
          backend,
          getBlockchainConfig(backend, url, opts)
        )

        // TODO: move label backup elsewhere
        const labelsDictionary: { [key: string]: string } = {}
        account.transactions.forEach((tx) => {
          const txRef = tx.id
          labelsDictionary[txRef] = tx.label || ''
        })
        account.utxos.forEach((utxo) => {
          const utxoRef = getUtxoOutpoint(utxo)
          labelsDictionary[utxoRef] = utxo.label
        })

        const { transactions, utxos, summary } = await getWalletData(
          wallet,
          network as Network
        )

        for (const index in utxos) {
          const utxoRef = getUtxoOutpoint(utxos[index])
          utxos[index].label = labelsDictionary[utxoRef]
        }
        for (const index in transactions) {
          const txRef = transactions[index].id
          transactions[index].label = labelsDictionary[txRef]
        }

        const txTimestamp = (tx: Transaction) => formatTimestamp(tx.timestamp)
        const timestamps = transactions.map(txTimestamp)
        const oracle = new MempoolOracle()
        const prices = await oracle.getPricesAt('USD', timestamps)
        transactions.forEach((_, index) => {
          transactions[index].prices = { USD: prices[index] }
        })

        return { ...account, transactions, utxos, summary }
      },
      addAccount: async (account) => {
        set(
          produce((state: AccountsState) => {
            state.accounts.push(account)
          })
        )
      },
      updateAccount: async (account) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (_account) => _account.name === account.name
            )
            if (index !== -1) state.accounts[index] = account
          })
        )
      },
      deleteAccounts: () => {
        set(() => ({ accounts: [] }))
      },
      getTags: () => {
        return get().tags
      },
      setTags: (tags: string[]) => {
        set({ tags })
      },
      getTx: (accountName: string, txid: string) => {
        const account = get().getCurrentAccount(accountName) as Account

        const transaction = account.transactions.find((tx) => tx.id === txid)

        if (transaction) return transaction

        throw new Error(`Transaction ${txid} does not exist`)
      },
      getUtxo: (accountName: string, txid: string, vout: number) => {
        const account = get().getCurrentAccount(accountName) as Account

        const utxo = account.utxos.find((u) => {
          return u.txid === txid && u.vout === vout
        })

        if (utxo) {
          return utxo
        }

        throw new Error(`Utxo ${txid}:${vout} does not exist`)
      },
      setTxLabel: (accountName, txid, label) => {
        const account = get().getCurrentAccount(accountName) as Account
        const txIndex = account.transactions.findIndex((tx) => tx.id === txid)

        if (! txIndex)
          throw new Error(`The transaction ${txid} does not exist in store`)

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.name === accountName
            )
            state.accounts[index].transactions[txIndex].label = label
          })
        )
      },
      setUtxoLabel: (accountName, txid, vout, label) => {
        const account = get().getCurrentAccount(accountName) as Account
        const utxoIndex = account.utxos.findIndex((u) => {
          return u.txid === txid && u.vout === vout
        })

        if (utxoIndex === -1)
          throw new Error(`Utxo ${txid}:${vout} does not exist`)

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.name === accountName
            )
            state.accounts[index].utxos[utxoIndex].label = label
          })
        )
      }
    }),
    {
      name: 'satsigner-accounts',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useAccountsStore }
