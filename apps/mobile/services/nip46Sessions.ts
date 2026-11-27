import type { Nip46BunkerService } from '@/api/nostrNip446'
import { useNip46Store } from '@/store/nip46'

// A live bunker holds the signer's secret key and answers requests until it is
// stopped, so every path that removes an identity or wipes the app stops it.
const services = new Map<string, Nip46BunkerService>()
const secretKeys = new Map<string, Uint8Array>()
const offerTimers = new Map<string, ReturnType<typeof setTimeout>>()

function getNip46Runtime(sessionId: string) {
  const service = services.get(sessionId)
  const secretKey = secretKeys.get(sessionId)
  return service && secretKey ? { secretKey, service } : null
}

function isNip46SessionActive(sessionId: string): boolean {
  return services.get(sessionId)?.isConnected() ?? false
}

function cancelNip46OfferExpiry(sessionId: string): void {
  clearTimeout(offerTimers.get(sessionId))
  offerTimers.delete(sessionId)
}

function stopNip46Session(sessionId: string): void {
  cancelNip46OfferExpiry(sessionId)
  services.get(sessionId)?.disconnect()
  services.delete(sessionId)
  secretKeys.get(sessionId)?.fill(0)
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

/** Stops an unclaimed `bunker://` offer when it expires, unless stopped first. */
function scheduleNip46OfferExpiry(
  sessionId: string,
  delayMs: number,
  onExpire: () => void
): void {
  cancelNip46OfferExpiry(sessionId)
  offerTimers.set(
    sessionId,
    setTimeout(() => {
      offerTimers.delete(sessionId)
      onExpire()
    }, delayMs)
  )
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
  cancelNip46OfferExpiry,
  getNip46Runtime,
  isNip46SessionActive,
  registerNip46Session,
  scheduleNip46OfferExpiry,
  stopAllNip46Sessions,
  stopNip46Session,
  teardownAllNip46Sessions,
  teardownNip46Identity
}
