/**
 * Logs to the console only in development builds. Use for debug tracing
 * (sync progress, RPC payloads, addresses, URLs) that should never ship to
 * production logs.
 */
function devLog(...args: unknown[]): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console -- intentional dev-only logging
    console.log(...args)
  }
}

export { devLog }
