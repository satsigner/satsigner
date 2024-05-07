import { BlockchainElectrumConfig } from 'bdk-rn/lib/lib/enums'

const defaultConfig: Omit<BlockchainElectrumConfig, 'url'> = {
  sock5: null,
  retry: 5,
  timeout: 5,
  stopGap: 500,
  validateDomain: false
}

const electrumBlockstream: BlockchainElectrumConfig = {
  ...defaultConfig,
  url: 'ssl://electrum.blockstream.info:60002'
}

export { electrumBlockstream }
