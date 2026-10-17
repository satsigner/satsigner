import ElectrumClient, {
  closeElectrumClientQuietly,
  ElectrumServerVersionSchema
} from '@/api/electrum'
import Esplora from '@/api/esplora'
import BitcoinRpc from '@/api/rpc'
import {
  BTC_PER_KVB_TO_SAT_PER_VB,
  CONNECTION_TEST_TIMEOUT_MS,
  ELECTRUM_CLIENT_INFO,
  RPC_FEE_TARGET_BLOCKS,
  SOFTWARE_LABELS
} from '@/constants/connectionTest'
import {
  type ConnectionTestSuccess,
  type NodeInfo
} from '@/types/models/ConnectionTest'
import {
  type Backend,
  type Network,
  type RpcCredentials
} from '@/types/settings/blockchain'
import { formatCoreVersion, formatRpcBanner } from '@/utils/rpcBanner'
import { expectedCoreChain, formatChainMismatchError } from '@/utils/rpcNetwork'

type ConnectionProbe = {
  result: ConnectionTestSuccess
  nodeInfo: NodeInfo
}

type ProbeParams = {
  url: string
  backend: Backend
  network: Network
  rpcCredentials?: RpcCredentials
  /** Receives the open Electrum client so the caller can close it early. */
  onElectrumClient?: (client: ElectrumClient) => void
}

async function probeElectrum(
  { url, network, onElectrumClient }: ProbeParams,
  startTime: number
): Promise<ConnectionProbe> {
  const client = ElectrumClient.fromUrl(url, network)
  onElectrumClient?.(client)
  try {
    return await readElectrumNode(client, network, startTime)
  } finally {
    closeElectrumClientQuietly(client)
  }
}

async function readElectrumNode(
  client: ElectrumClient,
  network: Network,
  startTime: number
): Promise<ConnectionProbe> {
  const serverInfo = await client.client.initElectrum(ELECTRUM_CLIENT_INFO, {
    callback: null,
    maxRetry: 0
  })
  const responseTime = Date.now() - startTime

  // Headers, timestamp and banner are optional: not every server supports them.
  const tip = await client.client
    .blockchainHeaders_subscribe()
    .catch(() => null)
  const blockHeight = tip?.height || 0
  const tipTimestampSec =
    blockHeight > 0
      ? await client.getBlockTimestamp(blockHeight).catch(() => undefined)
      : undefined
  const rawBanner = await client.client.server_banner().catch(() => null)
  const banner =
    typeof rawBanner === 'string' && rawBanner.trim()
      ? rawBanner.trim()
      : undefined

  const serverVersion = ElectrumServerVersionSchema.safeParse(serverInfo)

  return {
    nodeInfo: {
      blockHeight,
      network,
      responseTime,
      software: serverVersion.data?.[0] || SOFTWARE_LABELS.electrum,
      version: serverVersion.data?.[1] || 'Unknown'
    },
    result: {
      banner,
      blockHeight: blockHeight > 0 ? blockHeight : undefined,
      success: true,
      tipTimestampSec
    }
  }
}

async function getEsploraTipTimestamp(client: Esplora, blockHeight: number) {
  if (!Number.isFinite(blockHeight) || blockHeight <= 0) {
    return undefined
  }
  const tipHash = await client.getBlockAtHeight(blockHeight)
  const block = await client.getBlockInfo(tipHash)
  return block.timestamp
}

async function probeEsplora(
  { url, network }: ProbeParams,
  startTime: number
): Promise<ConnectionProbe> {
  const client = new Esplora(url)

  const rawHeight = await client.getLatestBlockHeight()
  const blockHeight =
    typeof rawHeight === 'number' ? rawHeight : Number(rawHeight)
  const responseTime = Date.now() - startTime

  const mempoolInfo = await client._call('/mempool')
  const feeEstimates = await client.getFeeEstimates()
  const tipTimestampSec = await getEsploraTipTimestamp(
    client,
    blockHeight
  ).catch(() => undefined)

  return {
    nodeInfo: {
      blockHeight,
      medianFee: feeEstimates['6'] || feeEstimates['3'] || undefined,
      mempoolSize: mempoolInfo?.count || undefined,
      network,
      responseTime,
      software: SOFTWARE_LABELS.esplora
    },
    result: {
      blockHeight: Number.isFinite(blockHeight) ? blockHeight : undefined,
      success: true,
      tipTimestampSec
    }
  }
}

async function probeRpc(
  { url, network, rpcCredentials }: ProbeParams,
  startTime: number
): Promise<ConnectionProbe> {
  const rpc = new BitcoinRpc(
    url,
    rpcCredentials?.username ?? '',
    rpcCredentials?.password ?? ''
  )

  const [chainInfo, networkInfo, mempoolInfo, feeResult, hasFilterIndex] =
    await Promise.all([
      rpc.getBlockchainInfo(),
      rpc.getNetworkInfo().catch(() => null),
      rpc.getMempoolInfo().catch(() => null),
      rpc.estimateSmartFee(RPC_FEE_TARGET_BLOCKS).catch(() => null),
      rpc.hasBlockFilterIndex().catch(() => false)
    ])
  const responseTime = Date.now() - startTime

  if (chainInfo.chain !== expectedCoreChain(network)) {
    throw new Error(formatChainMismatchError(network, chainInfo.chain, url))
  }

  return {
    nodeInfo: {
      blockHeight: chainInfo.blocks,
      chainWork: chainInfo.chainwork,
      medianFee: feeResult?.feerate
        ? Math.round(feeResult.feerate * BTC_PER_KVB_TO_SAT_PER_VB)
        : undefined,
      mempoolSize: mempoolInfo?.size,
      network: chainInfo.chain,
      responseTime,
      software: networkInfo?.subversion?.trim() || SOFTWARE_LABELS.rpc,
      version: networkInfo ? formatCoreVersion(networkInfo.version) : undefined
    },
    result: {
      banner: networkInfo ? formatRpcBanner(networkInfo, chainInfo) : undefined,
      blockFilterIndexMissing: !hasFilterIndex,
      blockHeight: chainInfo.blocks,
      success: true,
      tipTimestampSec: chainInfo.mediantime
    }
  }
}

const PROBES: Record<
  Backend,
  (params: ProbeParams, startTime: number) => Promise<ConnectionProbe>
> = {
  electrum: probeElectrum,
  esplora: probeEsplora,
  rpc: probeRpc
}

/**
 * Connects to a server, checks it serves the expected network, and collects
 * what the settings screen shows about it. Throws when the server is
 * unreachable, on the wrong chain, or slower than CONNECTION_TEST_TIMEOUT_MS.
 */
async function probeConnection(params: ProbeParams) {
  const timers: ReturnType<typeof setTimeout>[] = []
  const timedOut = new Promise<never>((_resolve, reject) => {
    timers.push(
      setTimeout(
        () => reject(new Error('Connection test timeout')),
        CONNECTION_TEST_TIMEOUT_MS
      )
    )
  })
  try {
    return await Promise.race([
      PROBES[params.backend](params, Date.now()),
      timedOut
    ])
  } finally {
    for (const timer of timers) {
      clearTimeout(timer)
    }
  }
}

/** Closes an Electrum client handed out through `onElectrumClient`. */
function closeProbeClient(client: ElectrumClient) {
  closeElectrumClientQuietly(client)
}

export { closeProbeClient, probeConnection }
