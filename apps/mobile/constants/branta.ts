import { type ProxyConfig } from '@/types/settings/blockchain'

export const BRANTA_ID_PARAM = 'branta_id'
export const BRANTA_SECRET_PARAM = 'branta_secret'

export const DEFAULT_TOR_PROXY: ProxyConfig = {
  enabled: true,
  host: '127.0.0.1',
  port: 9050
}

export const TOR_PROXY_PROBE_TIMEOUT_MS = 2000
