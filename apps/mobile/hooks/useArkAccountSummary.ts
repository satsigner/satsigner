import { useShallow } from 'zustand/react/shallow'

import { useArkStore } from '@/store/ark'

import { useArkAddresses } from './useArkAddresses'
import { useArkBalance } from './useArkBalance'
import { useArkVtxos } from './useArkVtxos'

// The balance, movements, VTXO and address queries write their results to the
// Ark store, so running them here keeps the summary current without opening
// the wallet detail screen.
export function useArkAccountSummary(accountId: string) {
  useArkBalance(accountId)
  useArkVtxos(accountId)
  useArkAddresses(accountId)

  return useArkStore(
    useShallow((state) => ({
      balance: state.balances[accountId],
      stats: state.stats[accountId]
    }))
  )
}
