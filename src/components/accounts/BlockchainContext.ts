import { createContext, useContext } from 'react';

import { Backend } from '../../enums/Backend';
import { Network } from '../../enums/Network';
import { Blockchain } from 'bdk-rn';

export const BlockchainContext = createContext({
  getIt: () => '',
  backend: Backend.Electrum,
  setBackend: (backend: Backend) => {},
  network: Network.Testnet,
  setNetwork: (network: Network) => {},
  url: '',
  setUrl: (url: string) => {},
  getBlockchain: async() => new Blockchain()
});

export const useBlockchainContext = () => {
  const context = useContext(BlockchainContext);
  if (context === undefined) {
    throw new Error('useBlockchainContext must be used within BlockchainContext Provider');
  }
  return context;
}
