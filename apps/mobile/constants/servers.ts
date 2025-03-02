import type { Server } from '@/types/settings/blockchain'

export const servers: Server[] = [
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
    name: 'Mempool',
    backend: 'esplora',
    network: 'testnet',
    url: 'https://mempool.space/testnet/api'
  },
  {
    name: 'Blockstream',
    backend: 'esplora',
    network: 'testnet',
    url: 'https://blockstream.info/testnet/api'
  },
  {
    name: 'Mutinynet',
    backend: 'esplora',
    network: 'testnet',
    url: 'https://mutinynet.com/api'
  }
]
