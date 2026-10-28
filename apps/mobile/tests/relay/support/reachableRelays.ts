import { execFileSync } from 'node:child_process'

const DEFAULT_LIVE_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://offchain.pub'
]
const PROBE_TIMEOUT_MS = 5000
const PROBE_PROCESS_TIMEOUT_MS = 15_000

// Runs in a child Node process so the answer is known synchronously, before
// jest registers the tests: it decides between describe and describe.skip.
const PROBE_SCRIPT = `
const urls = JSON.parse(process.argv[1])
const timeoutMs = Number(process.argv[2])
function probe(url) {
  return new Promise((resolve) => {
    const socket = new WebSocket(url)
    const timer = setTimeout(() => resolve(null), timeoutMs)
    socket.onopen = () => {
      clearTimeout(timer)
      socket.close()
      resolve(url)
    }
    socket.onerror = () => {
      clearTimeout(timer)
      resolve(null)
    }
  })
}
Promise.all(urls.map(probe)).then((results) => {
  process.stdout.write(JSON.stringify(results.filter(Boolean)))
  process.exit(0)
})
`

function configuredLiveRelays(): string[] {
  const fromEnv = (process.env.NOSTR_TEST_RELAYS ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
  return fromEnv.length > 0 ? fromEnv : DEFAULT_LIVE_RELAYS
}

function parseUrlList(raw: string): string[] {
  const parsed: unknown = JSON.parse(raw)
  return Array.isArray(parsed)
    ? parsed.filter((url) => typeof url === 'string')
    : []
}

function probeReachableRelaysSync(urls: string[]): string[] {
  try {
    const output = execFileSync(
      process.execPath,
      ['-e', PROBE_SCRIPT, JSON.stringify(urls), String(PROBE_TIMEOUT_MS)],
      { encoding: 'utf8', timeout: PROBE_PROCESS_TIMEOUT_MS }
    )
    return parseUrlList(output)
  } catch {
    return []
  }
}

export { configuredLiveRelays, probeReachableRelaysSync }
