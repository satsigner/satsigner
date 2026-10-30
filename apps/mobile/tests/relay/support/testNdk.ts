import NDK from '@nostr-dev-kit/ndk'

import { disconnectNdkPool } from '@/api/ndkRegistry'

const CONNECT_TIMEOUT_MS = 2000

const liveNdks = new Set<NDK>()

function trackNdk(ndk: NDK) {
  liveNdks.add(ndk)
}

function createTestNdk(relayUrls: string[]) {
  const ndk = new NDK({
    autoConnectUserRelays: false,
    enableOutboxModel: false,
    explicitRelayUrls: relayUrls
  })
  trackNdk(ndk)
  return ndk
}

// NDKRelay.disconnect() is a no-op once the relay is DISCONNECTED, which
// leaves its monitor intervals running; the connectivity layer always clears
// them and closes the socket without scheduling a reconnect. The pool is then
// emptied so NDK's outage detector has nothing left to reconnect.
function disconnectTestNdks() {
  for (const ndk of liveNdks) {
    for (const relay of ndk.pool.relays.values()) {
      relay.connectivity.disconnect()
    }
    disconnectNdkPool(ndk)
  }
  liveNdks.clear()
}

export { CONNECT_TIMEOUT_MS, createTestNdk, disconnectTestNdks, trackNdk }
