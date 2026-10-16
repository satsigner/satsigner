import { useQuery } from '@tanstack/react-query'

import { MempoolOracle } from '@/api/blockchain'
import { MempoolServers } from '@/constants/servers'
import { time } from '@/utils/time'

// Bitcoin Core `getblockchaininfo.chain` → mempool.space API base.
const HASH_RATE_API_BY_CHAIN: Record<string, string> = {
  main: MempoolServers.bitcoin,
  signet: MempoolServers.signet,
  test: MempoolServers.testnet
}

/** Network hash rate (H/s) for a Core chain, refreshed every minute. */
export function useNetworkHashRate(chain: string | undefined) {
  const baseUrl = chain
    ? (HASH_RATE_API_BY_CHAIN[chain] ?? HASH_RATE_API_BY_CHAIN.main)
    : undefined
  return useQuery({
    enabled: Boolean(baseUrl) && chain !== 'regtest',
    queryFn: () => new MempoolOracle(baseUrl ?? '').getLatestAverageHashRate(),
    queryKey: ['converter', 'network-hash-rate', chain],
    refetchInterval: time.minutes(1)
  })
}
