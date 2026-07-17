import { useQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'

import { useBlockchainStore } from '@/store/blockchain'
import {
  fetchTransactionOutspends,
  type TransactionOutspend
} from '@/utils/transactionOutspends'

type UseTransactionOutspendsParams = {
  enabled?: boolean
  outputs: { address: string; vout: number }[]
  txid: string
}

function useTransactionOutspends({
  enabled = true,
  outputs,
  txid
}: UseTransactionOutspendsParams) {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const pendingKey = outputs
    .map((output) => `${output.vout}:${output.address}`)
    .toSorted()
    .join('|')

  return useQuery<Map<number, TransactionOutspend>, Error>({
    enabled: enabled && Boolean(txid) && outputs.length > 0,
    queryFn: () => fetchTransactionOutspends(server, txid, outputs),
    queryKey: [
      'transaction-outspends',
      selectedNetwork,
      server.backend,
      server.url,
      txid,
      pendingKey
    ],
    staleTime: 30_000
  })
}

export { useTransactionOutspends }
