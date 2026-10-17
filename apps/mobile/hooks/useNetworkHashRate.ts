import { useQuery } from '@tanstack/react-query'

import { MempoolOracle } from '@/api/blockchain'
import { MEMPOOL_SERVER_BY_CORE_CHAIN } from '@/constants/servers'
import { time } from '@/utils/time'

/** Network hash rate (H/s) for a Core chain, refreshed every minute. */
export function useNetworkHashRate(chain: string | undefined) {
  const baseUrl = chain
    ? (MEMPOOL_SERVER_BY_CORE_CHAIN[chain] ?? MEMPOOL_SERVER_BY_CORE_CHAIN.main)
    : undefined
  return useQuery({
    enabled: Boolean(baseUrl) && chain !== 'regtest',
    queryFn: () => new MempoolOracle(baseUrl ?? '').getLatestAverageHashRate(),
    queryKey: ['converter', 'network-hash-rate', chain],
    refetchInterval: time.minutes(1)
  })
}
