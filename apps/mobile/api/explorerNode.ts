import ElectrumClient, { closeElectrumClientQuietly } from '@/api/electrum'
import BitcoinRpc from '@/api/rpc'
import { MAINNET_P2P_PORT } from '@/constants/btc'
import {
  BITNODES_API,
  BITNODES_SNAPSHOT_NODES_LIMIT,
  BITNODES_TOP_COUNTRIES_LIMIT,
  BITNODES_TOP_VERSIONS_LIMIT
} from '@/constants/explorer'
import type {
  Backend,
  Network,
  RpcCredentials
} from '@/types/settings/blockchain'
import { formatCoreVersion, formatRpcBanner } from '@/utils/rpcBanner'

export type BackendServerInfo = {
  serverSoftware: string
  protocolVersion: string
  banner: string
}

/** @deprecated Prefer BackendServerInfo */
export type ElectrumServerInfo = BackendServerInfo

export type BitnodesNodeInfo = {
  address: string
  userAgent: string
  height: number
  lastSeen: number
}

const EMPTY_SERVER_INFO: BackendServerInfo = {
  banner: '',
  protocolVersion: '',
  serverSoftware: ''
}

export async function fetchElectrumServerInfo(
  serverUrl: string,
  network: Network
): Promise<BackendServerInfo> {
  let client: ElectrumClient | null = null
  try {
    client = ElectrumClient.fromUrl(serverUrl, network)
    await client.init()

    const [versionResult, bannerResult] = await Promise.allSettled([
      client.getServerVersion(),
      client.getServerBanner()
    ])

    const version =
      versionResult.status === 'fulfilled' ? versionResult.value : ['', '']
    const banner =
      bannerResult.status === 'fulfilled' ? bannerResult.value.trim() : ''

    return {
      banner,
      protocolVersion: version[1] ?? '',
      serverSoftware: version[0] ?? ''
    }
  } catch {
    return EMPTY_SERVER_INFO
  } finally {
    closeElectrumClientQuietly(client)
  }
}

async function fetchRpcServerInfo(
  serverUrl: string,
  rpcCredentials?: RpcCredentials
): Promise<BackendServerInfo> {
  try {
    const rpc = new BitcoinRpc(
      serverUrl,
      rpcCredentials?.username ?? '',
      rpcCredentials?.password ?? ''
    )
    const [chainInfo, networkInfo] = await Promise.all([
      rpc.getBlockchainInfo(),
      rpc.getNetworkInfo()
    ])

    return {
      banner: formatRpcBanner(networkInfo, chainInfo),
      protocolVersion: networkInfo.protocolversion?.toString() ?? '',
      serverSoftware:
        networkInfo.subversion?.trim() ||
        `Bitcoin Core ${formatCoreVersion(networkInfo.version)}`
    }
  } catch {
    return EMPTY_SERVER_INFO
  }
}

export function fetchBackendServerInfo(
  serverUrl: string,
  backend: Backend,
  network: Network,
  rpcCredentials?: RpcCredentials
): Promise<BackendServerInfo> {
  if (backend === 'electrum') {
    return fetchElectrumServerInfo(serverUrl, network)
  }
  if (backend === 'rpc') {
    return fetchRpcServerInfo(serverUrl, rpcCredentials)
  }
  return Promise.resolve(EMPTY_SERVER_INFO)
}

function extractHost(url: string): string {
  try {
    const withProto = url.includes('://') ? url : `tcp://${url}`
    return new URL(withProto).hostname
  } catch {
    return url.replace(/.*:\/\//, '').replace(/:\d+$/, '')
  }
}

function extractPort(url: string): number {
  try {
    const withProto = url.includes('://') ? url : `tcp://${url}`
    const { port } = new URL(withProto)
    return port ? Number(port) : MAINNET_P2P_PORT
  } catch {
    const match = /:(\d+)$/.exec(url)
    return match ? Number(match[1]) : MAINNET_P2P_PORT
  }
}

export async function fetchBitnodesNodeInfo(
  serverUrl: string,
  network: Network
): Promise<BitnodesNodeInfo | null> {
  // Bitnodes only indexes mainnet. On testnet/signet the same host would match
  // an unrelated mainnet node record, so skip the lookup entirely.
  if (network !== 'bitcoin') {
    return null
  }
  const host = extractHost(serverUrl)
  if (!host) {
    return null
  }
  const port = extractPort(serverUrl)

  try {
    const nodeRes = await fetch(`${BITNODES_API}/nodes/${host}-${port}/`)
    if (!nodeRes.ok) {
      return null
    }

    const node = (await nodeRes.json()) as {
      user_agent: string
      height: number
      last_seen: number
    }

    return {
      address: host,
      height: node.height,
      lastSeen: node.last_seen,
      userAgent: node.user_agent
    }
  } catch {
    return null
  }
}

export type NetworkStats = {
  totalNodes: number
  versionDistribution: { version: string; count: number }[]
  countryDistribution: { country: string; count: number }[]
}

const EMPTY_NETWORK_STATS: NetworkStats = {
  countryDistribution: [],
  totalNodes: 0,
  versionDistribution: []
}

export async function fetchBitnodesNetworkStats(): Promise<NetworkStats> {
  try {
    return await fetchBitnodesNetworkStatsUnsafe()
  } catch {
    return EMPTY_NETWORK_STATS
  }
}

async function fetchBitnodesNetworkStatsUnsafe(): Promise<NetworkStats> {
  const snapshotRes = await fetch(`${BITNODES_API}/snapshots/?limit=1`)
  if (!snapshotRes.ok) {
    return EMPTY_NETWORK_STATS
  }
  const snapshot = (await snapshotRes.json()) as {
    results: { url: string; total_nodes: number }[]
  }

  const latest = snapshot.results?.[0]
  if (!latest) {
    return EMPTY_NETWORK_STATS
  }

  const nodesRes = await fetch(
    `${latest.url}?limit=${BITNODES_SNAPSHOT_NODES_LIMIT}`
  )
  if (!nodesRes.ok) {
    return EMPTY_NETWORK_STATS
  }
  const nodesData = (await nodesRes.json()) as {
    total_nodes: number
    nodes: Record<
      string,
      [
        number,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        number,
        string,
        string
      ]
    >
  }

  if (!nodesData.nodes || typeof nodesData.nodes !== 'object') {
    return { ...EMPTY_NETWORK_STATS, totalNodes: nodesData.total_nodes ?? 0 }
  }

  const versionMap: Record<string, number> = {}
  const countryMap: Record<string, number> = {}

  for (const node of Object.values(nodesData.nodes)) {
    const userAgent = node[2] ?? ''
    const country = node[7] ?? 'Unknown'

    const versionMatch = /\/([^:]+):[\d.]+/.exec(userAgent)
    const version = versionMatch ? `${versionMatch[1]}` : userAgent.slice(0, 20)

    versionMap[version] = (versionMap[version] ?? 0) + 1
    countryMap[country] = (countryMap[country] ?? 0) + 1
  }

  const versionDistribution = Object.entries(versionMap)
    .map(([version, count]) => ({ count, version }))
    .toSorted((a, b) => b.count - a.count)
    .slice(0, BITNODES_TOP_VERSIONS_LIMIT)

  const countryDistribution = Object.entries(countryMap)
    .map(([country, count]) => ({ count, country }))
    .toSorted((a, b) => b.count - a.count)
    .slice(0, BITNODES_TOP_COUNTRIES_LIMIT)

  return {
    countryDistribution,
    totalNodes: nodesData.total_nodes ?? latest.total_nodes,
    versionDistribution
  }
}
