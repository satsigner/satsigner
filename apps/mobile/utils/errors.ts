/**
 * Base class for errors Satsigner throws itself. Callers branch with
 * `instanceof` on a subclass instead of matching message text.
 */
class AppError extends Error {
  override name = 'AppError'
}

/** A server answered with a non-success HTTP status. */
class HttpStatusError extends AppError {
  override name = 'HttpStatusError'
  readonly status: number

  constructor(status: number, message: string, options?: ErrorOptions) {
    super(message, options)
    this.status = status
  }
}

/** A request did not complete within its time budget. */
class RequestTimeoutError extends AppError {
  override name = 'RequestTimeoutError'
}

/** A JSON-RPC server returned an error object. */
class RpcError extends AppError {
  override name = 'RpcError'
  readonly code: number

  constructor(code: number, message: string) {
    super(`RPC error ${code}: ${message}`)
    this.code = code
  }
}

/** No nostr relay could be reached to publish or fetch. */
class NostrNoRelaysError extends AppError {
  override name = 'NostrNoRelaysError'
}

export {
  AppError,
  HttpStatusError,
  NostrNoRelaysError,
  RpcError,
  RequestTimeoutError
}
