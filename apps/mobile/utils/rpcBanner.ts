import type { BlockchainInfo, NetworkInfo } from '@/api/rpc'

const CORE_VERSION_MAJOR_DIVISOR = 10000
const CORE_VERSION_MINOR_DIVISOR = 100

export function formatCoreVersion(version: number): string {
  const major = Math.floor(version / CORE_VERSION_MAJOR_DIVISOR)
  const minor = Math.floor(
    (version % CORE_VERSION_MAJOR_DIVISOR) / CORE_VERSION_MINOR_DIVISOR
  )
  const patch = version % CORE_VERSION_MINOR_DIVISOR
  return `${major}.${minor}.${patch}`
}

/**
 * Mirror Sparrow/Cormorant: banner is Core's subversion, with connection and
 * sync status appended when useful.
 */
export function formatRpcBanner(
  networkInfo: NetworkInfo,
  chainInfo: BlockchainInfo
): string {
  const lines: string[] = []
  const subversion = networkInfo.subversion?.trim()
  if (subversion) {
    lines.push(
      networkInfo.networkactive === false
        ? `${subversion} (disconnected)`
        : subversion
    )
  } else {
    lines.push(`Bitcoin Core ${formatCoreVersion(networkInfo.version)}`)
  }

  if (chainInfo.initialblockdownload) {
    const pct = Math.round((chainInfo.verificationprogress ?? 0) * 100)
    lines.push(`Initial block download (${pct}%)`)
  }

  if (chainInfo.pruned) {
    lines.push('Pruned node')
  }

  if (typeof networkInfo.connections === 'number') {
    lines.push(`${networkInfo.connections} peer connections`)
  }

  return lines.join('\n')
}
