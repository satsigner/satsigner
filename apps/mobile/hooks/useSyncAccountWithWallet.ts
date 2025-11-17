import { type Wallet } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { getWalletOverview, syncWallet } from '@/api/bdk'
import { MempoolOracle } from '@/api/blockchain'
import { getBlockchainConfig } from '@/config/servers'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { type Account } from '@/types/models/Account'
import { formatTimestamp } from '@/utils/format'
import { parseAccountAddressesDetails } from '@/utils/parse'
import { getUtxoOutpoint } from '@/utils/utxo'

function useSyncAccountWithWallet() {
  const setSyncStatus = useAccountsStore((state) => state.setSyncStatus)

  const [selectedNetwork, configs, configsMempol] = useBlockchainStore(
    useShallow((state) => [
      state.selectedNetwork,
      state.configs,
      state.configsMempool
    ])
  )
  const { server, config } = configs[selectedNetwork]

  const [loading, setLoading] = useState(false)

  async function syncAccountWithWallet(account: Account, wallet: Wallet) {
    try {
      setLoading(true)
      setSyncStatus(account.id, 'syncing')

      await syncWallet(
        wallet,
        server.backend,
        getBlockchainConfig(server.backend, server.url, {
          retries: config.retries,
          stopGap: config.stopGap,
          timeout: config.timeout * 1000
        })
      )

      const walletSummary = await getWalletOverview(
        wallet,
        server.network as Network,
        config.stopGap
      )

      const labels = account.labels || {}
      const updatedAccount: Account = { ...account, labels }

      updatedAccount.transactions = walletSummary.transactions
      updatedAccount.utxos = walletSummary.utxos
      updatedAccount.addresses = walletSummary.addresses
      updatedAccount.summary = walletSummary.summary

      // attach additional information to the account addresses
      updatedAccount.addresses = parseAccountAddressesDetails(updatedAccount)

      // utxo labels update
      for (const index in updatedAccount.utxos) {
        const utxo = updatedAccount.utxos[index]
        const utxoRef = getUtxoOutpoint(utxo)
        let label = labels[utxoRef]?.label
        // fall back to utxo's address's label
        if (!label && utxo.addressTo) {
          label = labels[utxo.addressTo]?.label
        }
        // save label inherited from address
        if (label && !labels[utxoRef]) {
          labels[utxoRef] = {
            type: 'output',
            ref: utxoRef,
            label
          }
        }
        updatedAccount.utxos[index].label = label || ''
      }

      // TX label update
      for (const index in updatedAccount.transactions) {
        const tx = updatedAccount.transactions[index]
        const { id: txRef, vout, vin } = tx
        let label = labels[txRef]?.label

        // fall back to tx's address' label
        if (!label && tx.vout.length > 0) {
          label = ''
          for (const output of tx.vout) {
            const outputAddress = output.address
            const outputLabel = labels[outputAddress]?.label
            if (!outputLabel) continue
            label += outputLabel + ','
          }
          label = label.replace(/,$/, '')
        }

        // save label inherited from address
        if (label && !labels[txRef]) {
          labels[txRef] = {
            type: 'tx',
            ref: txRef,
            label
          }
        }

        updatedAccount.transactions[index].label = label || ''

        updatedAccount.transactions[index].vout = vout.map((output, vout) => {
          const outputRef = `${tx.id}:${vout}`
          let outputLabel = labels[outputRef]?.label || ''
          if (!outputLabel && label) {
            outputLabel = `${label} - ${vout} output`
          }
          return {
            ...output,
            label: outputLabel
          }
        })

        updatedAccount.transactions[index].vin = vin.map((input) => {
          const { txid, vout } = input.previousOutput
          const inputRef = `${txid}:${vout}`
          let inputLabel = labels[inputRef]?.label
          if (!inputLabel && label) {
            inputLabel = `${label} - ${vout} input`
          }
          return {
            ...input,
            label: inputLabel
          }
        })
      }

      // address label update
      for (const index in updatedAccount.addresses) {
        const addressRef = updatedAccount.addresses[index].address
        const label = labels[addressRef]?.label
        updatedAccount.addresses[index].label = label || ''
      }

      // update labels with possible new labels inherited from receive address
      updatedAccount.labels = { ...labels }

      // extract timestamps
      const timestamps = updatedAccount.transactions
        .filter((transaction) => transaction.timestamp)
        .map((transaction) => formatTimestamp(transaction.timestamp!))

      // fetch prices
      const network = 'bitcoin' // always use mainnet when fetching prices
      const mempoolUrl = configsMempol[network]
      const oracle = new MempoolOracle(mempoolUrl)
      const prices = await oracle.getPricesAt('USD', timestamps)

      // transaction prices update
      for (const index in updatedAccount.transactions) {
        updatedAccount.transactions[index].prices = { USD: prices[index] }
      }

      updatedAccount.syncStatus = 'synced'
      updatedAccount.lastSyncedAt = new Date()

      return updatedAccount
    } catch {
      setSyncStatus(account.id, 'error')
      return account
    } finally {
      setLoading(false)
    }
  }

  return { syncAccountWithWallet, loading }
}

export default useSyncAccountWithWallet
