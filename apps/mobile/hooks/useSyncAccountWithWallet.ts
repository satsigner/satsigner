import { type Wallet } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData, syncWallet } from '@/api/bdk'
import { getBlockchainConfig } from '@/config/servers'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useWalletsStore } from '@/store/wallets'
import { type Account } from '@/types/models/Account'

function useSyncAccountWithWallet() {
  const [backend, network, retries, stopGap, timeout, url] = useBlockchainStore(
    useShallow((state) => [
      state.backend,
      state.network,
      state.retries,
      state.stopGap,
      state.timeout,
      state.url
    ])
  )

  const [loading, setLoading] = useState(false)

  async function syncAccountWithWallet(account: Account, wallet: Wallet) {
    setLoading(true)

    await syncWallet(
      wallet,
      backend,
      getBlockchainConfig(backend, url, { retries, stopGap, timeout })
    )

    const walletSummary = await getWalletData(wallet, network as Network)

    const updatedAccount: Account = { ...account }

    updatedAccount.transactions = walletSummary.transactions
    updatedAccount.utxos = walletSummary.utxos
    updatedAccount.summary = walletSummary.summary

    setLoading(false)

    return updatedAccount
  }

  return { syncAccountWithWallet, loading }
}

export default useSyncAccountWithWallet
