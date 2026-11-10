import ElectrumClient from '@/api/electrum'
import {
  CONNECTION_TEST_TIMEOUT_MS,
  CONNECTION_TEST_TOR_TIMEOUT_MS,
  ELECTRUM_REACHABILITY_TTL_MS
} from '@/constants/connectionTest'
import { isOnionUrl } from '@/utils/serverPrivacy'

type ReachabilityCheck = {
  checkedAt: number
  reachable: Promise<boolean>
}

const checks = new Map<string, ReachabilityCheck>()

/** Thrown when an Electrum server does not answer the reachability ping. */
export class ElectrumUnreachableError extends Error {
  readonly server: string
  readonly url: string

  constructor(url: string) {
    const server = serverLabel(url)
    super(`Electrum server ${server} is unreachable`)
    this.name = 'ElectrumUnreachableError'
    this.server = server
    this.url = url
  }
}

function serverLabel(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function currentCheck(url: string, now: number): ReachabilityCheck {
  const cached = checks.get(url)
  if (cached && now - cached.checkedAt < ELECTRUM_REACHABILITY_TTL_MS) {
    return cached
  }
  // The ping is a server.version call, which does not depend on the network.
  const check = {
    checkedAt: now,
    reachable: ElectrumClient.test(
      url,
      'bitcoin',
      isOnionUrl(url)
        ? CONNECTION_TEST_TOR_TIMEOUT_MS
        : CONNECTION_TEST_TIMEOUT_MS
    )
  }
  checks.set(url, check)
  return check
}

/**
 * BDK's Electrum client connects inside a synchronous native constructor, so
 * an unreachable server (a home node seen from mobile data) blocks the JS
 * thread for the full TCP timeout, about two minutes. This async ping fails
 * fast instead. Concurrent and recent callers share one check per server.
 */
export async function assertElectrumReachable(
  url: string,
  now = Date.now()
): Promise<void> {
  const reachable = await currentCheck(url, now).reachable
  if (!reachable) {
    throw new ElectrumUnreachableError(url)
  }
}

export function clearElectrumReachabilityChecks(): void {
  checks.clear()
}
