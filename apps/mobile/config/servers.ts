import {
  type BlockchainElectrumConfig,
  type BlockchainEsploraConfig
} from 'bdk-rn/lib/lib/enums'

import { type Backend } from '@/types/settings/blockchain'

const ELECTRUM_URL = 'ssl://bitcoin.lu.ke:50002'
const MEMPOOL_SIGNET_URL = 'ssl://mempool.space:60602'
const MEMPOOL_TESTNET_URL = 'https://mempool.space/testnet4/api'
const DEFAULT_TIME_OUT = 6
const DEFAULT_RETRIES = 5
const DEFAULT_STOP_GAP = 20

type CustomBlockchainConfig = {
  retries?: number
  timeout?: number
  stopGap?: number
}

function getBlockchainConfig(
  backend: Backend,
  url: string,
  options: CustomBlockchainConfig = {}
): BlockchainElectrumConfig | BlockchainEsploraConfig {
  switch (backend) {
    case 'electrum':
      return {
        url,
        sock5: null,
        retry: options.retries || 5,
        timeout: options.timeout || 5,
        stopGap: options.stopGap || 20,
        validateDomain: false
      }
    case 'esplora':
      return {
        baseUrl: url,
        timeout: options.timeout || 5,
        stopGap: options.stopGap || 20,
        proxy: null,
        concurrency: 4
      }
  }
}

export {
  DEFAULT_RETRIES,
  DEFAULT_STOP_GAP,
  DEFAULT_TIME_OUT,
  ELECTRUM_URL,
  getBlockchainConfig,
  MEMPOOL_SIGNET_URL,
  MEMPOOL_TESTNET_URL
}
