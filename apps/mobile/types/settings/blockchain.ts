export type Backend = 'electrum' | 'esplora'

export type Network = 'bitcoin' | 'testnet' | 'signet'

export interface ProxyConfig {
  enabled: boolean
  host: string
  port: number
}

export interface Server {
  name: string
  backend: Backend
  network: Network
  url: string
  proxy?: ProxyConfig
}

export interface Config {
  timeout: number
  retries: number
  stopGap: number
  connectionMode: 'auto' | 'manual'
  /* INFO: seconds before testing current connection */
  connectionTestInterval: number
  /* INFO: minutes before next auto-sync given last sync timestamp */
  timeDiffBeforeAutoSync: number
}
