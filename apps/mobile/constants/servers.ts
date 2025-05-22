import type { Network, Server } from '@/types/settings/blockchain'

export const servers: Server[] = [
  {
    name: 'Mempool',
    backend: 'esplora',
    url: 'https://mempool.space/api',
    network: 'bitcoin'
  },
  {
    name: 'Blockstream',
    backend: 'electrum',
    url: 'ssl://electrum.blockstream.info:50002',
    network: 'bitcoin'
  },
  {
    name: 'Luke BitcoinJS',
    backend: 'electrum',
    url: 'ssl://bitcoin.lu.ke:50002',
    network: 'bitcoin'
  },
  {
    name: 'DIY Nodes',
    backend: 'electrum',
    url: 'ssl://electrum.diynodes.com:50022',
    network: 'bitcoin'
  },
  {
    name: 'Seth For Privacy',
    backend: 'electrum',
    url: 'ssl://fulcrum.sethforprivacy.com:50002',
    network: 'bitcoin'
  },
  // SIGNET
  {
    name: 'Mempool',
    backend: 'electrum',
    network: 'signet',
    url: 'ssl://mempool.space:60602'
  },
  {
    name: 'Mempool',
    backend: 'esplora',
    network: 'signet',
    url: 'https://mempool.space/signet/api'
  },
  {
    name: 'Blockstream',
    backend: 'esplora',
    network: 'signet',
    url: 'https://blockstream.info/signet/api'
  },
  {
    name: 'Blockstream',
    backend: 'electrum',
    network: 'signet',
    url: 'ssl://electrum.blockstream.info:60002'
  },
  // TESTNET
  {
    name: 'Mempool Testnet4',
    backend: 'esplora',
    network: 'testnet',
    url: 'https://mempool.space/testnet4/api'
  },
  {
    name: 'Blockstream Testnet4',
    backend: 'esplora',
    network: 'testnet',
    url: 'https://blockstream.info/testnet/api'
  },
  {
    name: 'Mutinynet',
    backend: 'esplora',
    network: 'signet',
    url: 'https://mutinynet.com/api'
  }
]

export const MempoolServers: Record<Network, Server['url']> = {
  bitcoin: 'https://mempool.space/api',
  testnet: 'https://mempool.space/testnet4/api',
  signet: 'https://mempool.space/signet/api'
}
