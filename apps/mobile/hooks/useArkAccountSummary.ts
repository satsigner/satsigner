import { useShallow } from 'zustand/react/shallow'

import { useArkStore } from '@/store/ark'
import { getArkBalanceBreakdown } from '@/utils/ark'

import { useArkAddresses } from './useArkAddresses'
import { useArkBalance } from './useArkBalance'
import { useArkOnchainBalance } from './useArkBoard'
import { useArkVtxos } from './useArkVtxos'

// The balance, movements, VTXO and address queries write their results to the
// Ark store, so running them here keeps the summary current without opening
// the wallet detail screen.
export function useArkAccountSummary(accountId: string) {
  useArkBalance(accountId)
  useArkVtxos(accountId)
  useArkAddresses(accountId)
  const onchainBalanceQuery = useArkOnchainBalance(accountId)

  const { balance, cachedOnchainBalance, stats } = useArkStore(
    useShallow((state) => ({
      balance: state.balances[accountId],
      cachedOnchainBalance: state.onchainBalances[accountId],
      stats: state.stats[accountId]
    }))
  )
  const { totalSats } = getArkBalanceBreakdown(
    balance,
    onchainBalanceQuery.data ?? cachedOnchainBalance
  )
  return { stats, totalSats }
}
