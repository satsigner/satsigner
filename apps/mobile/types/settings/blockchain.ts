export type Backend = 'electrum' | 'esplora'

export type Network = 'bitcoin' | 'testnet' | 'signet'

export type ServerType = 'CUSTOM' | 'PUBLIC'

export type Server = {
  name: string
  backend: Backend
  network: Network
  url: string
}
