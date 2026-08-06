/**
 * New receiver nativeState blobs embed a PDK SessionEvent log so resume can
 * replay after process death. Legacy blobs are only `{ id, role, protocol }`
 * and cannot be rehydrated once the in-memory RECEIVERS map is gone.
 */
function receiverNativeStateIsDurable(
  nativeState: string | undefined
): boolean {
  if (!nativeState) {
    return false
  }
  try {
    const json = JSON.parse(
      typeof atob === 'function'
        ? atob(nativeState)
        : Buffer.from(nativeState, 'base64').toString('utf8')
    ) as { events?: unknown }
    return Array.isArray(json.events) && json.events.length > 0
  } catch {
    return false
  }
}

export { receiverNativeStateIsDurable }
