import NDK from '@nostr-dev-kit/ndk'

function createMobileNdk(explicitRelayUrls: string[]): NDK {
  return new NDK({
    autoConnectUserRelays: false,
    enableOutboxModel: false,
    explicitRelayUrls
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
  if (!ndk.pool) {
    return
  }
  ndk.pool.removeAllListeners()
  for (const url of ndk.pool.relays.keys()) {
    ndk.pool.removeRelay(url)
  }
}

// One NDK instance per relay set, shared across all NostrAPI callers.
// Prevents duplicate WebSocket connections when multiple screens use the same relays.
const ndkRegistry = new Map<string, NDK>()

function getOrCreateNdk(relays: string[]): NDK {
  const key = [...relays].toSorted().join(',')
  const existing = ndkRegistry.get(key)
  if (existing) {
    return existing
  }
  const ndk = createMobileNdk(relays)
  ndkRegistry.set(key, ndk)
  return ndk
}

function resetNdkForRelays(relays: string[]): NDK {
  const key = [...relays].toSorted().join(',')
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
  getOrCreateNdk,
  ndkRegistry,
  resetNdkForRelays
}
