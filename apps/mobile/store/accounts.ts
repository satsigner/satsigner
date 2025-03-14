import { Descriptor, type Wallet } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'
import { Transaction as TransactionParser } from 'bitcoinjs-lib'
import { produce } from 'immer'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import { type Account } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { type Transaction } from '@/types/models/Transaction'
import { type Label } from '@/utils/bip329'
import { getUtxoOutpoint } from '@/utils/utxo'

type AccountsState = {
  accounts: Account[]
  tags: string[]
}

type AccountsAction = {
  loadAddresses: (
    account: Account,
    count?: number,
    forceReload?: boolean
  ) => Promise<Address[]>
  fetchTxInputs: (account: string, txid: string) => Promise<void>
  addAccount: (account: Account) => void
  updateAccount: (account: Account) => Promise<void>
  updateAccountName: (id: Account['id'], newName: string) => void
  deleteAccount: (id: Account['id']) => void
  deleteAccounts: () => void
  getTags: () => string[]
  setTags: (tags: string[]) => void
  setAddrLabel: (account: string, addr: string, label: string) => void
  setTxLabel: (accountId: Account['id'], txid: string, label: string) => void
  setUtxoLabel: (
    accountId: Account['id'],
    txid: string,
    vout: number,
    label: string
  ) => void
  importLabels: (account: string, labels: Label[]) => number
}

const useAccountsStore = create<AccountsState & AccountsAction>()(
  persist(
    (set, get) => ({
      accounts: [],
      tags: [],
      loadAddresses: async (account, count = 10, forceReload = false) => {
        if (account.addresses.length >= count && !forceReload)
          return account.addresses
        if (!account.externalDescriptor)
          throw new Error('Cannot load addresses: descriptor is missing')

        const labelsDictionary: Record<string, string> = {}
        account.addresses.forEach((addr) => {
          return (labelsDictionary[addr.address] = addr.label)
        })

        const { network } = useBlockchainStore.getState()

        const externalDescriptor = await new Descriptor().create(
          account.externalDescriptor,
          network as Network
        )
        const internalDescriptor = account.internalDescriptor
          ? await new Descriptor().create(
              account.externalDescriptor,
              network as Network
            )
          : null

        const wallet = await get().loadWalletFromDescriptor(
          externalDescriptor,
          internalDescriptor
        )

        const { scriptVersion } = account
        const addrList = forceReload ? [] : [...account.addresses]

        for (let i = addrList.length; i < count; i += 1) {
          const receiveAddrInfo = await wallet.getAddress(i)
          const receiveAddr = await receiveAddrInfo.address.asString()
          const receiveAddrPath = account.derivationPath
            ? `${account.derivationPath}/0/${i}`
            : undefined
          addrList.push({
            address: receiveAddr,
            keychain: 'external',
            transactions: [],
            utxos: [],
            index: i,
            derivationPath: receiveAddrPath,
            network,
            scriptVersion,
            label: labelsDictionary[receiveAddr] || '',
            summary: {
              transactions: 0,
              utxos: 0,
              balance: 0,
              satsInMempool: 0
            }
          })

          if (!account.internalDescriptor) continue

          const changeAddrInfo = await wallet.getInternalAddress(i)
          const changeAddr = await changeAddrInfo.address.asString()

          // TODO: fix bug getInternalAddress() is the same as getAddress()
          if (changeAddr === receiveAddr) continue

          const changeAddrPath = account.derivationPath
            ? `${account.derivationPath}/1/${i}`
            : undefined
          addrList.push({
            address: changeAddr,
            keychain: 'internal',
            transactions: [],
            utxos: [],
            index: i,
            derivationPath: changeAddrPath,
            network,
            scriptVersion,
            label: labelsDictionary[changeAddr] || '',
            summary: {
              transactions: 0,
              utxos: 0,
              balance: 0,
              satsInMempool: 0
            }
          })
        }

        const addrDictionary: Record<string, number> = {}

        for (let i = 0; i < addrList.length; i += 1) {
          addrDictionary[addrList[i].address] = i
          addrList[i].summary.utxos = 0
          addrList[i].summary.balance = 0
          addrList[i].summary.satsInMempool = 0
          addrList[i].summary.transactions = 0
        }

        for (const tx of account.transactions) {
          for (const output of tx.vout) {
            if (addrDictionary[output.address] === undefined) continue
            const index = addrDictionary[output.address]
            addrList[index].summary.transactions += 1
            addrList[index].transactions.push(tx.id)
          }
        }

        for (const utxo of account.utxos) {
          if (!utxo.addressTo || addrDictionary[utxo.addressTo] === undefined)
            continue
          const index = addrDictionary[utxo.addressTo]
          addrList[index].summary.utxos += 1
          addrList[index].summary.balance += utxo.value
          addrList[index].utxos.push(getUtxoOutpoint(utxo))
        }

        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (_account) => _account.name === account.name
            )
            if (index !== -1) state.accounts[index].addresses = addrList
          })
        )
        return addrList
      },
      addAccount: (account) => {
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
              (_account) => _account.id === account.id
            )
            if (index !== -1) state.accounts[index] = account
          })
        )
      },
      updateAccountName: (id, newName) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.id === id
            )
            if (index !== -1) state.accounts[index].name = newName
          })
        )
      },
      deleteAccount: (id) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.id === id
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
      fetchTxInputs: async (accountName, txid) => {
        const accounts = get().accounts
        const accountIndex = accounts.findIndex(
          (account) => account.name === accountName
        )

        if (accountIndex === -1) return

        const account = accounts[accountIndex]
        const txIndex = account.transactions.findIndex((tx) => tx.id === txid)

        if (txIndex === -1) return

        const tx = account.transactions[txIndex]
        let mustFetchData = false
        for (const input of tx.vin) {
          if (input.value === undefined) {
            mustFetchData = true
            break
          }
        }
        if (!mustFetchData) return

        const { url, backend, network } = useBlockchainStore.getState()
        const vin: Transaction['vin'] = []

        if (backend === 'electrum') {
          const electrumClient = await ElectrumClient.fromUrl(url, network)
          const txIds = tx.vin.map((input) => input.previousOutput.txid)
          const vouts = tx.vin.map((input) => input.previousOutput.vout)
          const previousTxsRaw = await electrumClient.getTransactions(txIds)
          electrumClient.close()
          for (let i = 0; i < tx.vin.length; i += 1) {
            const vout = vouts[i]
            const prevTx = TransactionParser.fromHex(previousTxsRaw[i])
            const value = prevTx.outs[vout].value
            vin.push({ ...tx.vin[i], value })
          }
        }

        if (backend === 'esplora') {
          const esploraClient = new Esplora(url)
          const txData = await esploraClient.getTxInfo(txid)
          for (const input of txData.vin) {
            vin.push({
              previousOutput: {
                txid: input.txid,
                vout: input.vout
              },
              sequence: input.sequence,
              scriptSig: hexToBytes(input.scriptsig),
              value: input.prevout.value,
              witness: input.witness.map(hexToBytes)
            })
          }
        }

        set(
          produce((state) => {
            state.accounts[accountIndex].transactions[txIndex].vin = vin
          })
        )
      },
      setAddrLabel: (accountName, addr, label) => {
        const account = get().accounts.find(
          (account) => account.name === accountName
        )
        if (!account) return

        const addrIndex = account.addresses.findIndex(
          (address) => address.address === addr
        )
        if (addrIndex === -1) return

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.name === accountName
            )
            state.accounts[index].addresses[addrIndex].label = label
          })
        )
      },
      setTxLabel: (accountId, txid, label) => {
        const account = get().accounts.find(
          (account) => account.id === accountId
        )
        if (!account) return

        const txIndex = account.transactions.findIndex((tx) => tx.id === txid)
        if (txIndex === -1) return

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.id === accountId
            )
            state.accounts[index].transactions[txIndex].label = label
          })
        )
      },
      setUtxoLabel: (accountId, txid, vout, label) => {
        const account = get().accounts.find(
          (account) => account.id === accountId
        )
        if (!account) return

        const utxoIndex = account.utxos.findIndex((u) => {
          return u.txid === txid && u.vout === vout
        })
        if (utxoIndex === -1) return

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.id === accountId
            )
            state.accounts[index].utxos[utxoIndex].label = label
          })
        )
      },
      importLabels: (accountId: string, labels: Label[]) => {
        const account = get().accounts.find(
          (account) => account.id === accountId
        )

        if (!account) return 0

        const transactionMap: Record<string, number> = {}
        const utxoMap: Record<string, number> = {}
        const addressMap: Record<string, number> = {}

        account.transactions.forEach((tx, index) => {
          transactionMap[tx.id] = index
        })
        account.utxos.forEach((utxo, index) => {
          utxoMap[getUtxoOutpoint(utxo)] = index
        })
        account.addresses.forEach((address, index) => {
          addressMap[address.address] = index
        })

        let labelsAdded = 0

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.id === accountId
            )
            labels.forEach((labelObj) => {
              const label = labelObj.label
              if (labelObj.type === 'tx') {
                if (!transactionMap[labelObj.ref]) return
                const txIndex = transactionMap[labelObj.ref]
                state.accounts[index].transactions[txIndex].label = label
                labelsAdded += 1
              }
              if (labelObj.type === 'output') {
                if (!utxoMap[labelObj.ref]) return
                const utxoIndex = utxoMap[labelObj.ref]
                state.accounts[index].utxos[utxoIndex].label = label
                labelsAdded += 1
              }
              if (labelObj.type === 'addr') {
                if (!addressMap[labelObj.ref]) return
                const addrIndex = addressMap[labelObj.ref]
                state.accounts[index].addresses[addrIndex].label = label
                labelsAdded += 1
              }
            })
          })
        )
        return labelsAdded
      }
    }),
    {
      name: 'satsigner-accounts',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useAccountsStore }
