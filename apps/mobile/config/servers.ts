import {
  type BlockchainElectrumConfig,
  type BlockchainEsploraConfig
} from 'bdk-rn/lib/lib/enums'

import { type Backend } from '@/types/settings/blockchain'

const ELECTRUM_BLOCKSTREAM_URL = 'ssl://electrum.blockstream.info:60002'
const MEMPOOL_SIGNET_URL = 'ssl://mempool.space:60602'
const DEFAULT_TIME_OUT = 6
const DEFAULT_RETRIES = 5
const DEFAULT_STOP_GAP = 20

type customBlockchainConfig = {
  retries?: number
  timeout?: number
  stopGap?: number
}

function getBlockchainConfig(
  backend: Backend,
  url: string,
  options: customBlockchainConfig = {}
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
  ELECTRUM_BLOCKSTREAM_URL,
  getBlockchainConfig,
  MEMPOOL_SIGNET_URL
}
