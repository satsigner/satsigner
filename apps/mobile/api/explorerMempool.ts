import { MempoolOracle } from '@/api/blockchain'
import ElectrumClient from '@/api/electrum'
import type {
  MemPool,
  MemPoolBlock,
  MemPoolFees
} from '@/types/models/Blockchain'
import type { Network } from '@/types/settings/blockchain'

export type MempoolSource = 'backend' | 'mempool'

export type MempoolBasicData = {
  feeHistogram: [number, number][]
  vsizeFromHistogram: number
  source: MempoolSource
}

export type MempoolExtendedData = {
  count: number | null
  vsize: number
  totalFee: number | null
  fees: MemPoolFees | null
  pendingBlocks: MemPoolBlock[]
}

function safeClose(client: ElectrumClient | null): void {
  try {
    client?.close()
  } catch {
    /* silently ignored */
  }
}

export async function fetchMempoolBasicData(
  serverUrl: string,
  backend: string,
  network: Network
): Promise<MempoolBasicData> {
  if (backend === 'electrum' && serverUrl) {
    let client: ElectrumClient | null = null
    try {
      client = ElectrumClient.fromUrl(serverUrl, network)
      await client.init()
      const histogram = await client.getMempoolFeeHistogram()
      if (histogram.length > 0) {
        const vsizeFromHistogram = histogram.reduce(
          (sum, [, size]) => sum + size,
          0
        )
        return {
          feeHistogram: histogram,
          source: 'backend',
          vsizeFromHistogram
        }
      }
    } catch {
      /* fall through to mempool fallback */
    } finally {
      safeClose(client)
    }
  }

  return { feeHistogram: [], source: 'mempool', vsizeFromHistogram: 0 }
}

export async function fetchMempoolExtendedData(
  oracle: MempoolOracle
): Promise<MempoolExtendedData> {
  const [mempoolInfo, fees, pendingBlocks] = await Promise.all([
    oracle.getMemPool().catch(() => null),
    oracle.getMemPoolFees().catch(() => null),
    oracle.getMemPoolBlocks().catch(() => [])
  ])

  const info = mempoolInfo as MemPool | null

  return {
    count: info?.count ?? null,
    fees,
    pendingBlocks,
    totalFee: info?.total_fee ?? null,
    vsize: info?.vsize ?? 0
  }
}
