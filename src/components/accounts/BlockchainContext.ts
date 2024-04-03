import { createContext } from 'react';

export const BlockchainContext = createContext({
  getBlockchainHeight: async () => 0
});
