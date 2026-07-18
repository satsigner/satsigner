import { MempoolOracle } from '@/api/blockchain'
import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import BitcoinRpc from '@/api/rpc'
import type {
  MemPool,
  MemPoolBlock,
  MemPoolFees
} from '@/types/models/Blockchain'
import type {
  Backend,
  Network,
  RpcCredentials
} from '@/types/settings/blockchain'

export type MempoolSource = 'backend' | 'mempool'

export type MempoolBasicData = {
  feeHistogram: [number, number][]
  vsizeFromHistogram: number
  count: number | null
  vsize: number | null
  totalFee: number | null
  minFeeRate: number | null
  source: MempoolSource
}

export type MempoolExtendedData = {
  count: number | null
  vsize: number
  totalFee: number | null
  fees: MemPoolFees | null
  pendingBlocks: MemPoolBlock[]
}

const EMPTY_BASIC: MempoolBasicData = {
  count: null,
  feeHistogram: [],
  minFeeRate: null,
  source: 'backend',
  totalFee: null,
  vsize: null,
  vsizeFromHistogram: 0
}

function safeClose(client: ElectrumClient | null): void {
  try {
    client?.close()
  } catch {
    /* silently ignored */
  }
}

async function fromElectrum(
  serverUrl: string,
  network: Network
): Promise<MempoolBasicData> {
  let client: ElectrumClient | null = null
  try {
    client = ElectrumClient.fromUrl(serverUrl, network)
    await client.init()
    const histogram = await client.getMempoolFeeHistogram()
    if (histogram.length === 0) {
      return EMPTY_BASIC
    }
    const vsizeFromHistogram = histogram.reduce(
      (sum, [, size]) => sum + size,
      0
    )
    return {
      ...EMPTY_BASIC,
      feeHistogram: histogram,
      source: 'backend',
      vsize: vsizeFromHistogram,
      vsizeFromHistogram
    }
  } catch {
    return EMPTY_BASIC
  } finally {
    safeClose(client)
  }
}

async function fromEsplora(serverUrl: string): Promise<MempoolBasicData> {
  try {
    const esplora = new Esplora(serverUrl)
    const [info, estimates] = await Promise.all([
      esplora.getMempoolInfo(),
      esplora.getFeeEstimates().catch(() => null)
    ])
    const minFeeRate =
      estimates && typeof estimates === 'object' && '144' in estimates
        ? Number(Reflect.get(estimates, '144'))
        : null

    return {
      ...EMPTY_BASIC,
      count: typeof info?.count === 'number' ? info.count : null,
      minFeeRate: Number.isFinite(minFeeRate) ? minFeeRate : null,
      source: 'backend',
      totalFee: typeof info?.total_fee === 'number' ? info.total_fee : null,
      vsize: typeof info?.vsize === 'number' ? info.vsize : null,
      vsizeFromHistogram: typeof info?.vsize === 'number' ? info.vsize : 0
    }
  } catch {
    return EMPTY_BASIC
  }
}

async function fromRpc(
  serverUrl: string,
  rpcCredentials?: RpcCredentials
): Promise<MempoolBasicData> {
  try {
    const rpc = new BitcoinRpc(
      serverUrl,
      rpcCredentials?.username ?? '',
      rpcCredentials?.password ?? ''
    )
    const info = await rpc.getMempoolInfo()
    const minFeeRate = Math.round(info.mempoolminfee * 1e8) / 1000
    return {
      ...EMPTY_BASIC,
      count: info.size,
      minFeeRate,
      source: 'backend',
      vsize: info.bytes,
      vsizeFromHistogram: info.bytes
    }
  } catch {
    return EMPTY_BASIC
  }
}

export function fetchMempoolBasicData(
  serverUrl: string,
  backend: Backend,
  network: Network,
  rpcCredentials?: RpcCredentials
): Promise<MempoolBasicData> {
  if (!serverUrl) {
    return Promise.resolve(EMPTY_BASIC)
  }
  if (backend === 'electrum') {
    return fromElectrum(serverUrl, network)
  }
  if (backend === 'esplora') {
    return fromEsplora(serverUrl)
  }
  if (backend === 'rpc') {
    return fromRpc(serverUrl, rpcCredentials)
  }
  return Promise.resolve(EMPTY_BASIC)
}

export async function fetchMempoolExtendedData(
  oracle: MempoolOracle
): Promise<MempoolExtendedData> {
  const [mempoolInfo, fees, pendingBlocks] = await Promise.all([
    oracle.getMemPool().catch(() => null),
    oracle.getMemPoolFees().catch(() => null),
    oracle.getMemPoolBlocks().catch(() => [])
  ])

  const info: MemPool | null =
    mempoolInfo &&
    typeof mempoolInfo === 'object' &&
    'count' in mempoolInfo &&
    'vsize' in mempoolInfo
      ? mempoolInfo
      : null

  return {
    count: info?.count ?? null,
    fees,
    pendingBlocks,
    totalFee: info?.total_fee ?? null,
    vsize: info?.vsize ?? 0
  }
}
