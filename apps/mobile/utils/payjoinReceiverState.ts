import { isRecord } from '@/utils/object'

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
    const json: unknown = JSON.parse(
      typeof atob === 'function'
        ? atob(nativeState)
        : Buffer.from(nativeState, 'base64').toString('utf8')
    )
    return (
      isRecord(json) && Array.isArray(json.events) && json.events.length > 0
    )
  } catch {
    return false
  }
}

export { receiverNativeStateIsDurable }
