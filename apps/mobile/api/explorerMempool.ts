import { MempoolOracle } from '@/api/blockchain'
import ElectrumClient, { closeElectrumClientQuietly } from '@/api/electrum'
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
import { feesFromUnknownEsploraEstimates } from '@/utils/esploraFees'
import {
  type FeeHistogramBand,
  feesFromProjectedBlocks,
  normalizeHistogram,
  projectedBlocksFromHistogram
} from '@/utils/mempoolHistogram'
import { feesFromBtcPerKb, feesFromSmartFeeTargets } from '@/utils/rpcFees'

export type MempoolSource = 'backend' | 'mempool'

export type MempoolBasicData = {
  feeHistogram: FeeHistogramBand[]
  vsizeFromHistogram: number
  count: number | null
  vsize: number | null
  totalFee: number | null
  minFeeRate: number | null
  fees: MemPoolFees | null
  /** Approximate backlog from fee histogram (not CPFP-aware). */
  projectedBlocks: MemPoolBlock[]
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
  fees: null,
  minFeeRate: null,
  projectedBlocks: [],
  source: 'backend',
  totalFee: null,
  vsize: null,
  vsizeFromHistogram: 0
}

function histogramVsize(histogram: FeeHistogramBand[]): number {
  return histogram.reduce((sum, [, size]) => sum + size, 0)
}

function withHistogramDerived(
  base: MempoolBasicData,
  histogram: FeeHistogramBand[],
  feesOverride?: MemPoolFees | null
): MempoolBasicData {
  const projectedBlocks = projectedBlocksFromHistogram(histogram)
  const fees =
    feesOverride ??
    feesFromProjectedBlocks(projectedBlocks, base.minFeeRate) ??
    base.fees

  return {
    ...base,
    feeHistogram: histogram,
    fees,
    projectedBlocks,
    vsize:
      base.vsize ?? (histogram.length > 0 ? histogramVsize(histogram) : null),
    vsizeFromHistogram:
      histogram.length > 0 ? histogramVsize(histogram) : base.vsizeFromHistogram
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
    const histogram = normalizeHistogram(await client.getMempoolFeeHistogram())
    if (histogram.length === 0) {
      return EMPTY_BASIC
    }
    const vsizeFromHistogram = histogramVsize(histogram)
    return withHistogramDerived(
      {
        ...EMPTY_BASIC,
        source: 'backend',
        vsize: vsizeFromHistogram,
        vsizeFromHistogram
      },
      histogram
    )
  } catch {
    return EMPTY_BASIC
  } finally {
    closeElectrumClientQuietly(client)
  }
}

async function fromEsplora(serverUrl: string): Promise<MempoolBasicData> {
  try {
    const esplora = new Esplora(serverUrl)
    const [info, estimates] = await Promise.all([
      esplora.getMempoolInfo(),
      esplora.getFeeEstimates().catch(() => null)
    ])

    const estimateFees = feesFromUnknownEsploraEstimates(estimates)
    const minFeeRate = estimateFees?.none ?? null
    const histogram = normalizeHistogram(
      info && typeof info === 'object'
        ? Reflect.get(info, 'fee_histogram')
        : null
    )

    const base: MempoolBasicData = {
      ...EMPTY_BASIC,
      count: typeof info?.count === 'number' ? info.count : null,
      fees: estimateFees,
      minFeeRate,
      source: 'backend',
      totalFee: typeof info?.total_fee === 'number' ? info.total_fee : null,
      vsize: typeof info?.vsize === 'number' ? info.vsize : null,
      vsizeFromHistogram: typeof info?.vsize === 'number' ? info.vsize : 0
    }

    if (histogram.length === 0) {
      return base
    }

    return withHistogramDerived(base, histogram, estimateFees)
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
    const [info, fee1, fee3, fee6] = await Promise.all([
      rpc.getMempoolInfo(),
      rpc.estimateSmartFee(1).catch(() => null),
      rpc.estimateSmartFee(3).catch(() => null),
      rpc.estimateSmartFee(6).catch(() => null)
    ])

    const fees =
      feesFromSmartFeeTargets({
        highBtcPerKb: fee1?.feerate ?? null,
        lowBtcPerKb: fee6?.feerate ?? null,
        mediumBtcPerKb: fee3?.feerate ?? null,
        minBtcPerKb: info.mempoolminfee
      }) ??
      (typeof info.mempoolminfee === 'number'
        ? feesFromBtcPerKb(info.mempoolminfee)
        : null)

    const minFeeRate =
      fees?.none ??
      (typeof info.mempoolminfee === 'number'
        ? Math.round(info.mempoolminfee * 1e8) / 1000
        : null)

    return {
      ...EMPTY_BASIC,
      count: info.size,
      fees,
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

export async function fetchBackendNextBlockFee(
  serverUrl: string,
  backend: Backend,
  network: Network,
  rpcCredentials?: RpcCredentials
): Promise<number | null> {
  const data = await fetchMempoolBasicData(
    serverUrl,
    backend,
    network,
    rpcCredentials
  )
  return data.fees?.high ?? null
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
