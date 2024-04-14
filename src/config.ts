import { BlockchainElectrumConfig } from 'bdk-rn/lib/lib/enums';

export const blockchainElectrumConfig: BlockchainElectrumConfig = {
  url: 'ssl://electrum.blockstream.info:60002',
  sock5: null,
  retry: 5,
  timeout: 5,
  stopGap: 500,
  validateDomain: false,
};
