export type Backend = 'electrum' | 'esplora'

export type Network = 'bitcoin' | 'testnet' | 'signet'

export type ServerType = 'CUSTOM' | 'PUBLIC'

export type Server = {
  name: string
  backend: Backend
  network: Network
  url: string
}

export type Config = {
  timeout: number
  retries: number
  stopGap: number
  connectionMode: 'auto' | 'manual'
  connectionTestInterval: number
}
