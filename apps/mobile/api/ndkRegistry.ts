import NDK, { tryNormalizeRelayUrl } from '@nostr-dev-kit/ndk'

// NDK keys a subscription's relays by these URLs but its partial-EOSE check
// matches them against the pool's normalized URLs (trailing slash). Without
// normalizing, one silent relay makes every subscription wait for its EOSE.
function normalizeRelayUrls(urls: string[]): string[] {
  return [...new Set(urls.flatMap((url) => tryNormalizeRelayUrl(url) ?? []))]
}

function createMobileNdk(explicitRelayUrls: string[]): NDK {
  return new NDK({
    autoConnectUserRelays: false,
    enableOutboxModel: false,
    explicitRelayUrls: normalizeRelayUrls(explicitRelayUrls)
  })
}

/** Ephemeral instance for one-off fetches (indexer relays, probes). */
function createEphemeralNdk(explicitRelayUrls: string[]): NDK {
  return createMobileNdk(explicitRelayUrls)
}

/**
 * Tears a pool down for good. Relays are removed from the pool rather than
 * only disconnected: when most of a pool drops at once NDK treats it as a
 * network outage and reconnects every relay still in the pool, leaving
 * sockets open on an instance nothing references any more.
 */
function disconnectNdkPool(ndk: NDK): void {
  const { pool } = ndk
  if (!pool) {
    return
  }
  pool.removeAllListeners()
  for (const relay of pool.relays.values()) {
    // A socket can open after the relay leaves the pool. NDK then logs
    // "relay not found in pool" from the connect handler still attached here.
    relay.removeAllListeners()
    relay.disconnect()
  }
  const urls = [...pool.relays.keys()]
  for (const url of urls) {
    pool.relays.delete(url)
  }
}

// One NDK instance per relay set, shared across all NostrAPI callers.
// Prevents duplicate WebSocket connections when multiple screens use the same relays.
const ndkRegistry = new Map<string, NDK>()

// Keyed by normalized URLs so "wss://x" and "wss://x/" share one pool.
function registryKey(relays: string[]): string {
  return normalizeRelayUrls(relays).toSorted().join(',')
}

function getOrCreateNdk(relays: string[]): NDK {
  const key = registryKey(relays)
  const existing = ndkRegistry.get(key)
  if (existing) {
    return existing
  }
  const ndk = createMobileNdk(relays)
  ndkRegistry.set(key, ndk)
  return ndk
}

function findNdkForRelays(relays: string[]): NDK | undefined {
  return ndkRegistry.get(registryKey(relays))
}

function resetNdkForRelays(relays: string[]): NDK {
  const key = registryKey(relays)
  const existing = ndkRegistry.get(key)
  if (existing) {
    disconnectNdkPool(existing)
    ndkRegistry.delete(key)
  }
  const ndk = createMobileNdk(relays)
  ndkRegistry.set(key, ndk)
  return ndk
}

export function clearNdkRegistry(): void {
  for (const ndk of ndkRegistry.values()) {
    disconnectNdkPool(ndk)
  }
  ndkRegistry.clear()
}

export {
  createEphemeralNdk,
  createMobileNdk,
  disconnectNdkPool,
  findNdkForRelays,
  getOrCreateNdk,
  ndkRegistry,
  resetNdkForRelays
}
