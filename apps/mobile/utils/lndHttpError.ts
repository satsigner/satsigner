import { HttpStatusError } from '@/utils/errors'

const LND_PERMISSION_STATUSES = new Set([401, 403])
/** LND `makeRequest` messages start with `LND API error: <status>`. */
const LND_PERMISSION_MESSAGE = /^LND API error: (401|403)\b/

/**
 * True when LND rejected the macaroon. Takes the thrown error, or its message
 * when the caller only kept the text.
 */
export function isLndPermissionError(error: unknown): boolean {
  if (error instanceof HttpStatusError) {
    return LND_PERMISSION_STATUSES.has(error.status)
  }
  return LND_PERMISSION_MESSAGE.test(getLndErrorMessage(error))
}

export function getLndErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
