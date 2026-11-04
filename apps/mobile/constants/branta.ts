const BRANTA_HTTPS_HOSTS = [
  'guardrail.branta.pro',
  'staging.guardrail.branta.pro'
] as const

const BRANTA_LOOKUP_TIMEOUT_MS = 8000

const BRANTA_TOR_PROXY_HOST = '127.0.0.1'

const BRANTA_TOR_PROXY_PORT = 9050

export {
  BRANTA_HTTPS_HOSTS,
  BRANTA_LOOKUP_TIMEOUT_MS,
  BRANTA_TOR_PROXY_HOST,
  BRANTA_TOR_PROXY_PORT
}
