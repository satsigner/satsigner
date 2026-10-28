import type NDK from '@nostr-dev-kit/ndk'

import {
  NOSTR_FIRST_RELAY_CONNECT_TIMEOUT_MS,
  NOSTR_RELAY_COOLDOWN_MS
} from '@/constants/nostr'
import { NostrNoRelaysError } from '@/utils/errors'

type NostrRelayHealthStatus = 'connected' | 'connecting' | 'disconnected'

type NostrRelayHealth = {
  cooldownUntil: number
  lastClosedReason?: string
  lastConnectedAt?: number
  lastDisconnectedAt?: number
  lastEoseAt?: number
  status: NostrRelayHealthStatus
  url: string
}

const healthByUrl = new Map<string, NostrRelayHealth>()
const trackedNdks = new WeakSet<NDK>()

function normalizeRelayUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, '')
}

function getOrCreateHealth(url: string): NostrRelayHealth {
  const key = normalizeRelayUrl(url)
  const existing = healthByUrl.get(key)
  if (existing) {
    return existing
  }
  const created: NostrRelayHealth = {
    cooldownUntil: 0,
    status: 'disconnected',
    url: key
  }
  healthByUrl.set(key, created)
  return created
}

function updateHealth(url: string, patch: Partial<NostrRelayHealth>): void {
  healthByUrl.set(normalizeRelayUrl(url), {
    ...getOrCreateHealth(url),
    ...patch
  })
}

function markRelayConnecting(url: string): void {
  updateHealth(url, { status: 'connecting' })
}

function markRelayConnected(url: string, now = Date.now()): void {
  updateHealth(url, {
    cooldownUntil: 0,
    lastConnectedAt: now,
    status: 'connected'
  })
}

function markRelayFailed(url: string, now = Date.now()): void {
  updateHealth(url, {
    cooldownUntil: now + NOSTR_RELAY_COOLDOWN_MS,
    lastDisconnectedAt: now,
    status: 'disconnected'
  })
}

function markRelayEose(url: string, now = Date.now()): void {
  updateHealth(url, { cooldownUntil: 0, lastEoseAt: now })
}

function markRelayClosed(url: string, reason: string, now = Date.now()): void {
  updateHealth(url, {
    cooldownUntil: now + NOSTR_RELAY_COOLDOWN_MS,
    lastClosedReason: reason
  })
}

function isRelayCoolingDown(url: string, now = Date.now()): boolean {
  return getOrCreateHealth(url).cooldownUntil > now
}

function getRelayHealthSnapshot(urls?: string[]): NostrRelayHealth[] {
  if (!urls) {
    return [...healthByUrl.values()]
  }
  return urls.map((url) => ({ ...getOrCreateHealth(url) }))
}

function resetRelayHealth(): void {
  healthByUrl.clear()
}

function trackNdkRelayHealth(ndk: NDK): void {
  if (trackedNdks.has(ndk) || !ndk.pool) {
    return
  }
  trackedNdks.add(ndk)
  ndk.pool.on('relay:connecting', (relay) => markRelayConnecting(relay.url))
  ndk.pool.on('relay:connect', (relay) => markRelayConnected(relay.url))
  ndk.pool.on('relay:disconnect', (relay) => markRelayFailed(relay.url))
}

async function startConnecting(ndk: NDK, timeoutMs: number): Promise<void> {
  try {
    await ndk.connect(timeoutMs)
  } catch {
    // Per-relay failures surface through the pool's disconnect events.
  }
}

function connectedRelayCount(ndk: NDK): number {
  return ndk.pool?.connectedRelays().length ?? 0
}

function markUnconnectedRelaysFailed(ndk: NDK): void {
  const connected = new Set(
    ndk.pool.connectedRelays().map((relay) => normalizeRelayUrl(relay.url))
  )
  for (const url of ndk.pool.relays.keys()) {
    if (!connected.has(normalizeRelayUrl(url))) {
      markRelayFailed(url)
    }
  }
}

/**
 * Starts NDK connecting and resolves as soon as the first relay is up.
 * NDK's own `connect(timeout)` resolves after the timeout even when zero
 * relays connected, and waits for every relay when one is slow.
 */
function connectToFirstRelay(
  ndk: NDK,
  timeoutMs = NOSTR_FIRST_RELAY_CONNECT_TIMEOUT_MS
): Promise<void> {
  trackNdkRelayHealth(ndk)
  void startConnecting(ndk, timeoutMs)

  if (connectedRelayCount(ndk) > 0) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ndk.pool.off('relay:connect', onConnect)
      markUnconnectedRelaysFailed(ndk)
      reject(
        new NostrNoRelaysError(
          `No relay connections established (0/${ndk.pool.relays.size})`
        )
      )
    }, timeoutMs)

    function onConnect() {
      clearTimeout(timer)
      ndk.pool.off('relay:connect', onConnect)
      // Relays still not up when the deadline passes go on cooldown too,
      // without holding up the caller that already has one relay.
      setTimeout(() => markUnconnectedRelaysFailed(ndk), timeoutMs)
      resolve()
    }

    ndk.pool.on('relay:connect', onConnect)
  })
}

export {
  connectToFirstRelay,
  getRelayHealthSnapshot,
  isRelayCoolingDown,
  markRelayClosed,
  markRelayConnected,
  markRelayEose,
  markRelayFailed,
  normalizeRelayUrl,
  resetRelayHealth,
  trackNdkRelayHealth
}
export type { NostrRelayHealth, NostrRelayHealthStatus }
