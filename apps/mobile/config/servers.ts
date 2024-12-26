import {
  BlockchainElectrumConfig,
  BlockchainEsploraConfig
} from 'bdk-rn/lib/lib/enums'

import { Backend } from '@/types/settings/blockchain'

const ELECTRUM_BLOCKSTREAM_URL = 'ssl://electrum.blockstream.info:60002'
const ESPLORA_MUTINYNET_URL = 'https://mutinynet.com/api'

type customBlockchainConfig = {
  retries?: number
  timeout?: number
  stopGap?: number
}

function getBlockchainConfig(
  backend: Backend,
  url: string,
  options: customBlockchainConfig
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

export { ELECTRUM_BLOCKSTREAM_URL, ESPLORA_MUTINYNET_URL, getBlockchainConfig }
