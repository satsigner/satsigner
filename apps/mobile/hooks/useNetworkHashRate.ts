import { skipToken, useQuery } from '@tanstack/react-query'

import { MempoolOracle } from '@/api/blockchain'
import { REGTEST_CORE_CHAIN } from '@/constants/energy'
import { MEMPOOL_SERVER_BY_CORE_CHAIN } from '@/constants/servers'
import { time } from '@/utils/time'

/**
 * Network hash rate (H/s) for a Core chain, refreshed every minute. Not
 * fetched on regtest.
 */
export function useNetworkHashRate(chain: string | undefined) {
  const baseUrl =
    chain && chain !== REGTEST_CORE_CHAIN
      ? (MEMPOOL_SERVER_BY_CORE_CHAIN[chain] ??
        MEMPOOL_SERVER_BY_CORE_CHAIN.main)
      : undefined
  return useQuery({
    queryFn: baseUrl
      ? () => new MempoolOracle(baseUrl).getLatestAverageHashRate()
      : skipToken,
    queryKey: ['converter', 'network-hash-rate', chain],
    refetchInterval: time.minutes(1)
  })
}
