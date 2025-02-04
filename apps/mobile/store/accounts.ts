import { Descriptor, Wallet } from 'bdk-rn'
import { Network } from 'bdk-rn/lib/lib/enums'
import { produce } from 'immer'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getWalletData, getWalletFromDescriptor, syncWallet } from '@/api/bdk'
import { MempoolOracle } from '@/api/blockchain'
import { PIN_KEY } from '@/config/auth'
import { getBlockchainConfig } from '@/config/servers'
import { getItem } from '@/storage/encrypted'
import mmkvStorage from '@/storage/mmkv'
import { type Account } from '@/types/models/Account'
import { type Label } from '@/utils/bip329'
import { aesDecrypt } from '@/utils/crypto'
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
  updateAccountName: (name: string, newName: string) => void
  deleteAccount: (name: string) => void
  deleteAccounts: () => void
  getTags: () => string[]
  setTags: (tags: string[]) => void
  setTxLabel: (account: string, txid: string, label: string) => void
  setUtxoLabel: (
    account: string,
    txid: string,
    vout: number,
    label: string
  ) => void
  importLabels: (account: string, labels: Label[]) => void
  decryptSeed: (account: string) => Promise<string>
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
        const labelsDictionary: Record<string, string> = {}
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

        const timestamps = transactions
          .filter((transaction) => transaction.timestamp)
          .map((transaction) => formatTimestamp(transaction.timestamp!))

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
      updateAccountName: (name, newName) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.name === name
            )
            if (index !== -1) state.accounts[index].name = newName
          })
        )
      },
      deleteAccount: (name: string) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.name === name
            )
            if (index !== -1) {
              state.accounts.splice(index, 1)
            }
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
      setTxLabel: (accountName, txid, label) => {
        const account = get().getCurrentAccount(accountName)
        if (!account) return

        const txIndex = account.transactions.findIndex((tx) => tx.id === txid)
        if (txIndex === -1) return

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
        const account = get().getCurrentAccount(accountName)
        if (!account) return

        const utxoIndex = account.utxos.findIndex((u) => {
          return u.txid === txid && u.vout === vout
        })
        if (utxoIndex === -1) return

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.name === accountName
            )
            state.accounts[index].utxos[utxoIndex].label = label
          })
        )
      },
      importLabels: (accountName: string, labels: Label[]) => {
        const account = get().getCurrentAccount(accountName)

        if (!account) return

        const transactionMap: Record<string, number> = {}
        const utxoMap: Record<string, number> = {}

        account.transactions.forEach((tx, index) => {
          transactionMap[tx.id] = index
        })
        account.utxos.forEach((utxo, index) => {
          utxoMap[getUtxoOutpoint(utxo)] = index
        })

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.name === accountName
            )
            labels.forEach((labelObj) => {
              const label = labelObj.label

              if (labelObj.type === 'tx') {
                if (!transactionMap[labelObj.ref]) return
                const txIndex = transactionMap[labelObj.ref]
                state.accounts[index].transactions[txIndex].label = label
              }
              if (labelObj.type === 'output') {
                if (!utxoMap[labelObj.ref]) return
                const utxoIndex = utxoMap[labelObj.ref]
                state.accounts[index].utxos[utxoIndex].label = label
              }
            })
          })
        )
      },
      async decryptSeed(accountName) {
        const account = get().accounts.find(
          (_account) => _account.name === accountName
        )
        if (!account || !account.seedWords) return ''
        const savedPin = await getItem(PIN_KEY)
        if (!savedPin) return ''
        return aesDecrypt(account.seedWords, savedPin)
      }
    }),
    {
      name: 'satsigner-accounts',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useAccountsStore }
