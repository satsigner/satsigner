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

function disconnectNdkPool(ndk: NDK): void {
  try {
    ndk.pool?.removeAllListeners?.()
    for (const relay of ndk.pool?.relays.values() ?? []) {
      relay.disconnect()
    }
  } catch {
    // best-effort cleanup
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
    for (const relay of existing.pool?.relays.values() ?? []) {
      try {
        relay.disconnect()
      } catch {
        // best-effort
      }
    }
    ndkRegistry.delete(key)
  }
  const ndk = createMobileNdk(relays)
  ndkRegistry.set(key, ndk)
  return ndk
}

export function clearNdkRegistry(): void {
  for (const ndk of ndkRegistry.values()) {
    for (const relay of ndk.pool?.relays.values() ?? []) {
      try {
        relay.disconnect()
      } catch {
        // best-effort
      }
    }
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
