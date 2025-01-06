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
import { TxOut } from '@/types/models/Blockchain'
import { Transaction } from '@/types/models/Transaction'
import { Utxo } from '@/types/models/Utxo'
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
  getTx: (accountName: string, txid: string) => Promise<Transaction>
  getUtxo: (accountName: string, txid: string, vout: number) => Promise<Utxo>
  setUtxoLabel: (
    accountName: string,
    txid: string,
    vout: number,
    label: string
  ) => Promise<void>
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

        const oldUtxos = account.utxos
        const utxoLabelsDictionary: { [key: string]: string } = {}
        oldUtxos.forEach((utxo) => {
          const utxoRef = getUtxoOutpoint(utxo)
          utxoLabelsDictionary[utxoRef] = utxo.label
        })

        const { transactions, utxos, summary } = await getWalletData(
          wallet,
          network as Network
        )

        for (const index in utxos) {
          const utxoRef = getUtxoOutpoint(utxos[index])
          utxos[index].label = utxoLabelsDictionary[utxoRef]
        }

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
      getTx: async (accountName: string, txid: string) => {
        const account = get().getCurrentAccount(accountName) as Account

        const transaction = account.transactions.find((tx) => tx.id === txid)

        if (transaction) return transaction

        // TODO: replace MempoolOracle with BDK for enhanced privacy
        const { url } = useBlockchainStore.getState()
        const oracle = new MempoolOracle(url)
        const data = await oracle.getTransaction(txid)

        const newTransaction: Transaction = {
          id: data.txid,
          type: 'receive', // TODO: how to figure it out?
          label: '',
          sent: 0,
          received: 0,
          timestamp: new Date(data.status.block_time),
          size: data.size,
          vout: data.vout.map((out: TxOut) => ({
            value: out.value,
            address: out.scriptpubkey_address as string
          }))
        }

        account.transactions.push(newTransaction)
        get().updateAccount(account)

        return newTransaction
      },
      getUtxo: async (accountName: string, txid: string, vout: number) => {
        const account = get().getCurrentAccount(accountName) as Account

        const utxo = account.utxos.find((u) => {
          return u.txid === txid && u.vout === vout
        })

        if (utxo) {
          return utxo
        }

        const tx = await get().getTx(accountName, txid)

        const newUtxo: Utxo = {
          txid,
          vout,
          label: '',
          value: tx.vout[vout].value,
          timestamp: tx.timestamp,
          addressTo: tx.vout[vout].address,
          keychain: 'external' // TODO: is it right?
        }

        account.utxos.push(newUtxo)
        get().updateAccount(account)

        return newUtxo
      },
      setUtxoLabel: async (accountName, txid, vout, label) => {
        const account = get().getCurrentAccount(accountName) as Account

        let utxoIndex = account.utxos.findIndex((u) => {
          return u.txid === txid && u.vout === vout
        })

        if (utxoIndex === -1) {
          await get().getUtxo(accountName, txid, vout)
          utxoIndex = account.utxos.length
        }

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
