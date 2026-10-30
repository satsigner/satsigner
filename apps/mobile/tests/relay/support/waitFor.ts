const DEFAULT_WAIT_MS = 10_000
const POLL_INTERVAL_MS = 20

function waitFor(
  predicate: () => boolean,
  { label = 'condition', timeoutMs = DEFAULT_WAIT_MS } = {}
): Promise<void> {
  const startedAt = Date.now()
  return new Promise<void>((resolve, reject) => {
    function poll() {
      if (predicate()) {
        resolve()
        return
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`${label} not met within ${timeoutMs}ms`))
        return
      }
      setTimeout(poll, POLL_INTERVAL_MS)
    }
    poll()
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export { delay, waitFor }
