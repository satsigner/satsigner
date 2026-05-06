import ElectrumClient from '@/api/electrum'
import type { Network } from '@/types/settings/blockchain'

export type ElectrumServerInfo = {
  serverSoftware: string
  protocolVersion: string
  banner: string
}

export type BitnodesNodeInfo = {
  address: string
  userAgent: string
  height: number
  lastSeen: number
}

const BITNODES_API = 'https://bitnodes.io/api/v1'

function safeClose(client: ElectrumClient | null): void {
  try {
    client?.close()
  } catch {
    /* silently ignored */
  }
}

export async function fetchElectrumServerInfo(
  serverUrl: string,
  network: Network
): Promise<ElectrumServerInfo> {
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
    const banner = bannerResult.status === 'fulfilled' ? bannerResult.value : ''

    return {
      banner,
      protocolVersion: version[1] ?? '',
      serverSoftware: version[0] ?? ''
    }
  } catch {
    return { banner: '', protocolVersion: '', serverSoftware: '' }
  } finally {
    safeClose(client)
  }
}

function extractHost(url: string): string {
  try {
    const withProto = url.includes('://') ? url : `tcp://${url}`
    return new URL(withProto).hostname
  } catch {
    return url.replace(/.*:\/\//, '').replace(/:\d+$/, '')
  }
}

export async function fetchBitnodesNodeInfo(
  serverUrl: string
): Promise<BitnodesNodeInfo | null> {
  const host = extractHost(serverUrl)
  if (!host) {
    return null
  }

  try {
    const snapshotRes = await fetch(`${BITNODES_API}/snapshots/?limit=1`)
    const snapshot = (await snapshotRes.json()) as {
      results: { url: string }[]
    }
    if (!snapshot.results?.[0]?.url) {
      return null
    }

    const nodeRes = await fetch(`${BITNODES_API}/nodes/${host}-8333/`)
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

export async function fetchBitnodesNetworkStats(): Promise<NetworkStats> {
  const snapshotRes = await fetch(`${BITNODES_API}/snapshots/?limit=1`)
  const snapshot = (await snapshotRes.json()) as {
    results: { url: string; total_nodes: number }[]
  }

  const latest = snapshot.results?.[0]
  if (!latest) {
    return { countryDistribution: [], totalNodes: 0, versionDistribution: [] }
  }

  const nodesRes = await fetch(`${latest.url}?limit=500`)
  const nodesData = (await nodesRes.json()) as {
    total_nodes: number
    nodes: Record<
      string,
      [
        number,
        number,
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

  const versionMap: Record<string, number> = {}
  const countryMap: Record<string, number> = {}

  for (const node of Object.values(nodesData.nodes)) {
    const userAgent = node[1] ?? ''
    const country = node[7] ?? 'Unknown'

    const versionMatch = /\/([^:]+):[\d.]+/.exec(userAgent)
    const version = versionMatch ? `${versionMatch[1]}` : userAgent.slice(0, 20)

    versionMap[version] = (versionMap[version] ?? 0) + 1
    countryMap[country] = (countryMap[country] ?? 0) + 1
  }

  const versionDistribution = Object.entries(versionMap)
    .map(([version, count]) => ({ count, version }))
    .toSorted((a, b) => b.count - a.count)
    .slice(0, 10)

  const countryDistribution = Object.entries(countryMap)
    .map(([country, count]) => ({ count, country }))
    .toSorted((a, b) => b.count - a.count)
    .slice(0, 15)

  return {
    countryDistribution,
    totalNodes: nodesData.total_nodes ?? latest.total_nodes,
    versionDistribution
  }
}
