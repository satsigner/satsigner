import type { Network, Server } from '@/types/settings/blockchain'

export const servers: Server[] = [
  {
    backend: 'esplora',
    name: 'Mempool',
    network: 'bitcoin',
    url: 'https://mempool.space/api'
  },
  {
    backend: 'electrum',
    name: 'Blockstream',
    network: 'bitcoin',
    url: 'ssl://electrum.blockstream.info:50002'
  },
  {
    backend: 'electrum',
    name: 'Luke BitcoinJS',
    network: 'bitcoin',
    url: 'ssl://bitcoin.lu.ke:50002'
  },
  {
    backend: 'electrum',
    name: 'DIY Nodes',
    network: 'bitcoin',
    url: 'ssl://electrum.diynodes.com:50022'
  },
  {
    backend: 'electrum',
    name: 'Seth For Privacy',
    network: 'bitcoin',
    url: 'ssl://fulcrum.sethforprivacy.com:50002'
  },
  // SIGNET
  {
    backend: 'electrum',
    name: 'Mempool',
    network: 'signet',
    url: 'ssl://mempool.space:60602'
  },
  {
    backend: 'esplora',
    name: 'Mempool',
    network: 'signet',
    url: 'https://mempool.space/signet/api'
  },
  {
    backend: 'esplora',
    name: 'Blockstream',
    network: 'signet',
    url: 'https://blockstream.info/signet/api'
  },
  {
    backend: 'electrum',
    name: 'Blockstream',
    network: 'signet',
    url: 'ssl://electrum.blockstream.info:60002'
  },
  // TESTNET
  {
    backend: 'esplora',
    name: 'Mempool Testnet4',
    network: 'testnet',
    url: 'https://mempool.space/testnet4/api'
  },
  {
    backend: 'esplora',
    name: 'Blockstream Testnet4',
    network: 'testnet',
    url: 'https://blockstream.info/testnet/api'
  },
  {
    backend: 'esplora',
    name: 'Mutinynet',
    network: 'signet',
    url: 'https://mutinynet.com/api'
  }
]

export const MempoolServers: Record<Network, Server['url']> = {
  bitcoin: 'https://mempool.space/api',
  signet: 'https://mempool.space/signet/api',
  testnet: 'https://mempool.space/testnet4/api'
}
