import ElectrumClient, { closeElectrumClientQuietly } from '@/api/electrum'
import Esplora from '@/api/esplora'
import BitcoinRpc from '@/api/rpc'
import { CONNECTION_TEST_TIMEOUT_MS } from '@/constants/connectionTest'
import {
  type ConnectionTestSuccess,
  type ProbeParams
} from '@/types/models/ConnectionTest'
import { type Backend } from '@/types/settings/blockchain'
import { formatRpcBanner } from '@/utils/rpcBanner'
import { expectedCoreChain, formatChainMismatchError } from '@/utils/rpcNetwork'
import { withTimeout } from '@/utils/time'

async function probeElectrum({
  url,
  network,
  onElectrumClientOpened
}: ProbeParams): Promise<ConnectionTestSuccess> {
  const client = ElectrumClient.fromUrl(url, network)
  onElectrumClientOpened?.(client)
  try {
    return await readElectrumTip(client)
  } finally {
    closeElectrumClientQuietly(client)
  }
}

async function readElectrumTip(
  client: ElectrumClient
): Promise<ConnectionTestSuccess> {
  await client.init()

  // Headers, timestamp and banner are optional: not every server supports them.
  const tip = await client.subscribeToBlockHeaders().catch(() => null)
  const tipHeight = tip?.height ?? 0
  const blockHeight = tipHeight > 0 ? tipHeight : undefined
  const tipTimestampSec = blockHeight
    ? await client.getBlockTimestamp(blockHeight).catch(() => undefined)
    : undefined
  const banner = await client.getServerBanner().catch(() => '')

  return {
    banner: banner.trim() || undefined,
    blockHeight,
    success: true,
    tipTimestampSec
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

async function probeEsplora({
  url
}: ProbeParams): Promise<ConnectionTestSuccess> {
  const client = new Esplora(url)

  const blockHeight = Number(await client.getLatestBlockHeight())
  const tipTimestampSec = await getEsploraTipTimestamp(
    client,
    blockHeight
  ).catch(() => undefined)

  return {
    blockHeight: Number.isFinite(blockHeight) ? blockHeight : undefined,
    success: true,
    tipTimestampSec
  }
}

async function probeRpc({
  url,
  network,
  rpcCredentials
}: ProbeParams): Promise<ConnectionTestSuccess> {
  const rpc = new BitcoinRpc(
    url,
    rpcCredentials?.username ?? '',
    rpcCredentials?.password ?? ''
  )

  const [chainInfo, networkInfo, hasFilterIndex] = await Promise.all([
    rpc.getBlockchainInfo(),
    rpc.getNetworkInfo().catch(() => null),
    rpc.hasBlockFilterIndex().catch(() => false)
  ])

  if (chainInfo.chain !== expectedCoreChain(network)) {
    throw new Error(formatChainMismatchError(network, chainInfo.chain, url))
  }

  return {
    banner: networkInfo ? formatRpcBanner(networkInfo, chainInfo) : undefined,
    blockFilterIndexMissing: !hasFilterIndex,
    blockHeight: chainInfo.blocks,
    success: true,
    tipTimestampSec: chainInfo.mediantime
  }
}

const PROBES: Record<
  Backend,
  (params: ProbeParams) => Promise<ConnectionTestSuccess>
> = {
  electrum: probeElectrum,
  esplora: probeEsplora,
  rpc: probeRpc
}

/**
 * Connects to a server, checks it serves the expected network, and reads its
 * tip for the settings screens. Throws when the server is unreachable, on the
 * wrong chain, or slower than CONNECTION_TEST_TIMEOUT_MS.
 */
function probeConnection(params: ProbeParams) {
  return withTimeout(
    PROBES[params.backend](params),
    CONNECTION_TEST_TIMEOUT_MS,
    'Connection test timeout'
  )
}

/** Closes an Electrum client handed out through `onElectrumClientOpened`. */
function closeProbeClient(client: ElectrumClient) {
  closeElectrumClientQuietly(client)
}

export { closeProbeClient, probeConnection }
