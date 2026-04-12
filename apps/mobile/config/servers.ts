import { type Backend, type ProxyConfig } from '@/types/settings/blockchain'

const MEMPOOL_MAINNET_URL = 'https://mempool.space/api'
const MEMPOOL_SIGNET_URL = 'ssl://mempool.space:60602'
const MEMPOOL_TESTNET_URL = 'https://mempool.space/testnet4/api'
const DEFAULT_TIME_OUT = 15
const DEFAULT_RETRIES = 5
const DEFAULT_STOP_GAP = 20

type CustomBlockchainConfig = {
  retries?: number
  timeout?: number
  stopGap?: number
  proxy?: ProxyConfig
}

type BlockchainConfig = {
  url: string
  backend: Backend
  stopGap: number
}

function getBlockchainConfig(
  backend: Backend,
  url: string,
  options: CustomBlockchainConfig = {}
): BlockchainConfig {
  return {
    backend,
    stopGap: options.stopGap || DEFAULT_STOP_GAP,
    url
  }
}

export {
  DEFAULT_RETRIES,
  DEFAULT_STOP_GAP,
  DEFAULT_TIME_OUT,
  getBlockchainConfig,
  MEMPOOL_MAINNET_URL,
  MEMPOOL_SIGNET_URL,
  MEMPOOL_TESTNET_URL
}

export type { BlockchainConfig }
