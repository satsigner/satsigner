import ElectrumClient from '@/api/electrum'
import { Esplora } from '@/api/esplora'
import { useBlockchainStore } from '@/store/blockchain'
import { type Account } from '@/types/models/Account'
import { Transaction } from '@/types/models/Transaction'
import { parseAddressDescriptorToAddress, parseHexToBytes } from '@/utils/parse'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

function useSyncAccountWithAddress() {
  const [backend, network, url] = useBlockchainStore(
    useShallow((state) => [state.backend, state.network, state.url])
  )

  const [loading, setLoading] = useState(false)

  async function syncAccountWithAddress(
    account: Account,
    addressDescriptor: string
  ) {
    setLoading(true)

    const address = parseAddressDescriptorToAddress(addressDescriptor)

    const updatedAccount: Account = { ...account }

    let transactions: Account['transactions'] = []
    let utxos: Account['utxos'] = []
    let summary: Account['summary']

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
            witness: input.witness.map(parseHexToBytes)
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
      const port = url.replace(/.*:/, '')
      const protocol = url.replace(/:\/\/.*/, '')
      const host = url.replace(`${protocol}://`, '').replace(`:${port}`, '')

      if (
        !host.match(/^[a-z][a-z.]+$/i) ||
        !port.match(/^[0-9]+$/) ||
        (protocol !== 'ssl' && protocol !== 'tls' && protocol !== 'tcp')
      )
        throw new Error('Invalid backend URL')

      const electrumClient = new ElectrumClient({
        host,
        port: Number(port),
        protocol,
        network
      })

      await electrumClient.init()
      const addrInfo = await electrumClient.getAddressInfo(address)
      electrumClient.close()
      transactions = addrInfo.transactions
      utxos = addrInfo.utxos
      confirmed = addrInfo.balance.confirmed
      unconfirmed = addrInfo.balance.unconfirmed
    }

    summary = {
      numberOfAddresses: 1,
      numberOfTransactions: transactions.length,
      numberOfUtxos: utxos.length,
      satsInMempool: unconfirmed,
      balance: confirmed
    }

    updatedAccount.transactions = transactions
    updatedAccount.utxos = utxos
    updatedAccount.summary = summary

    setLoading(false)

    return updatedAccount
  }

  return { syncAccountWithAddress, loading }
}

export default useSyncAccountWithAddress
