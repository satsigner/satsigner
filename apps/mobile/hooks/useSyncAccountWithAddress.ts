import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { MempoolOracle } from '@/api/blockchain'
import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import { formatTimestamp } from '@/utils/format'
import { parseAddressDescriptorToAddress, parseHexToBytes } from '@/utils/parse'
import { getUtxoOutpoint } from '@/utils/utxo'

// Hook required because bdk does not support address descriptor
function useSyncAccountWithAddress() {
  const setIsSyncing = useAccountsStore((state) => state.setIsSyncing)
  const [backend, network, url] = useBlockchainStore(
    useShallow((state) => [state.backend, state.network, state.url])
  )

  const [loading, setLoading] = useState(false)

  async function syncAccountWithAddress(
    account: Account,
    addressDescriptor: string
  ) {
    try {
      setLoading(true)
      setIsSyncing(account.id, true)

      // Labels backup
      const labelsBackup: Record<string, string> = {}
      for (const transaction of account.transactions) {
        labelsBackup[transaction.id] = transaction.label || ''
      }
      for (const utxo of account.utxos) {
        labelsBackup[getUtxoOutpoint(utxo)] = utxo.label || ''
      }

      const address = parseAddressDescriptorToAddress(addressDescriptor)

      const updatedAccount: Account = { ...account }

      let transactions: Account['transactions'] = []
      let utxos: Account['utxos'] = []

      let confirmed = 0
      let unconfirmed = 0

      if (backend === 'esplora') {
        const esploraClient = new Esplora(url)
        const esploraTxs = await esploraClient.getAddressTx(address)
        const esploraUtxos = await esploraClient.getAddressUtxos(address)

        const txDictionary: Record<string, number> = {}

        for (let index = 0; index < esploraTxs.length; index++) {
          const t = esploraTxs[index]
          const vin: Transaction['vin'] = []
          const vout: Transaction['vout'] = []
          let sent = 0
          let received = 0

          t.vin.forEach((input) => {
            vin.push({
              previousOutput: {
                txid: input.txid,
                vout: input.vout
              },
              sequence: input.sequence,
              scriptSig: parseHexToBytes(input.scriptsig),
              witness: input.witness ? input.witness.map(parseHexToBytes) : []
            })
            if (input.prevout.scriptpubkey_address === address) {
              sent += input.prevout.value
            }
          })

          t.vout.forEach((out) => {
            vout.push({
              value: out.value,
              address: out.scriptpubkey_address,
              script: parseHexToBytes(out.scriptpubkey)
            })
            if (out.scriptpubkey_address === address) {
              received += out.value
            }
          })

          const raw = await esploraClient.getTxHex(t.txid)

          const tx = {
            address,
            blockHeight: t.status.block_height,
            fee: t.fee,
            id: t.txid,
            label: '',
            locktime: t.locktime,
            lockTimeEnabled: t.locktime > 0,
            prices: {},
            raw: parseHexToBytes(raw),
            received,
            sent,
            size: t.size,
            timestamp: new Date(t.status.block_time * 1000),
            type: sent > 0 ? 'send' : 'receive',
            version: t.version,
            vin,
            vout,
            weight: t.weight
          } as Transaction

          txDictionary[tx.id] = index
          transactions.push(tx)
        }

        utxos = esploraUtxos.map((u) => {
          if (u.status.confirmed) confirmed += u.value
          else unconfirmed += u.value

          let script: number[] | undefined
          if (txDictionary[u.txid] !== undefined) {
            const index = txDictionary[u.txid]
            const tx = esploraTxs[index]
            script = parseHexToBytes(tx.vout[u.vout].scriptpubkey)
          }

          return {
            txid: u.txid,
            vout: u.vout,
            value: u.value,
            label: '',
            addressTo: address,
            keychain: 'external',
            script,
            timestamp: u.status.block_time
              ? new Date(u.status.block_time * 1000)
              : undefined
          }
        })
      } else if (backend === 'electrum') {
        const electrumClient = ElectrumClient.fromUrl(
          url,
          network
        )

        await electrumClient.init()
        const addrInfo = await electrumClient.getAddressInfo(address)
        try {
          electrumClient.close()
        } catch {
          //
        }
        transactions = addrInfo.transactions
        utxos = addrInfo.utxos
        confirmed = addrInfo.balance.confirmed
        unconfirmed = addrInfo.balance.unconfirmed
      }

      const summary = {
        numberOfAddresses: 1,
        numberOfTransactions: transactions.length,
        numberOfUtxos: utxos.length,
        satsInMempool: unconfirmed,
        balance: confirmed
      }

      updatedAccount.transactions = transactions
      updatedAccount.utxos = utxos
      updatedAccount.summary = summary

      //Labels update
      for (const index in updatedAccount.utxos) {
        const utxoRef = getUtxoOutpoint(updatedAccount.utxos[index])
        updatedAccount.utxos[index].label = labelsBackup[utxoRef] || ''
      }
      for (const index in updatedAccount.transactions) {
        const transactionRef = updatedAccount.transactions[index].id
        updatedAccount.transactions[index].label =
          labelsBackup[transactionRef] || ''
      }

      //Extract timestamps
      const timestamps = updatedAccount.transactions
        .filter((transaction) => transaction.timestamp)
        .map((transaction) => formatTimestamp(transaction.timestamp!))

      //Fetch Prices
      const oracle = new MempoolOracle()
      const prices = await oracle.getPricesAt('USD', timestamps)

      //Transaction prices update
      for (const index in updatedAccount.transactions) {
        updatedAccount.transactions[index].prices = { USD: prices[index] }
      }

      updatedAccount.isSyncing = false

      return updatedAccount
    } catch {
      setIsSyncing(account.id, false)
      throw new Error('Error syncing wallet')
    } finally {
      setLoading(false)
    }
  }

  return { syncAccountWithAddress, loading }
}

export default useSyncAccountWithAddress
