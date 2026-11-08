import type { Nip46BunkerService } from '@/api/nostrNip446'
import { useNip46Store } from '@/store/nip46'

// A live bunker holds the signer's secret key and answers requests until it is
// stopped, so every path that removes an identity or wipes the app stops it.
const services = new Map<string, Nip46BunkerService>()
const secretKeys = new Map<string, Uint8Array>()

function getNip46Runtime(sessionId: string) {
  const service = services.get(sessionId)
  const secretKey = secretKeys.get(sessionId)
  return service && secretKey ? { secretKey, service } : null
}

function isNip46SessionActive(sessionId: string): boolean {
  return services.get(sessionId)?.isConnected() ?? false
}

function stopNip46Session(sessionId: string): void {
  services.get(sessionId)?.disconnect()
  services.delete(sessionId)
  secretKeys.delete(sessionId)
}

function registerNip46Session(
  sessionId: string,
  service: Nip46BunkerService,
  secretKey: Uint8Array
): void {
  stopNip46Session(sessionId)
  services.set(sessionId, service)
  secretKeys.set(sessionId, secretKey)
}

function stopAllNip46Sessions(): void {
  for (const sessionId of services.keys()) {
    stopNip46Session(sessionId)
  }
}

/** Stops and forgets every bunker session that signs for `npub`. */
function teardownNip46Identity(npub: string): void {
  const store = useNip46Store.getState()
  for (const session of store.getSessionsForIdentity(npub)) {
    stopNip46Session(session.id)
  }
  store.clearSessionsForIdentity(npub)
}

function teardownAllNip46Sessions(): void {
  stopAllNip46Sessions()
  useNip46Store.getState().clearAll()
}

export {
  getNip46Runtime,
  isNip46SessionActive,
  registerNip46Session,
  stopAllNip46Sessions,
  stopNip46Session,
  teardownAllNip46Sessions,
  teardownNip46Identity
}
