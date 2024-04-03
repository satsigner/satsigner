import { Blockchain } from 'bdk-rn';

import { BlockchainContext } from "./BlockchainContext";

import { blockchainElectrumConfig } from '../../config';

export const BlockchainProvider = ({ children }) => {

  const getBlockchainHeight = async(): Promise<number> => {
    const blockchain = await new Blockchain().create(blockchainElectrumConfig);
    return await blockchain.getHeight();
  };

  const value = {
    getBlockchainHeight
  };

  return (
    <BlockchainContext.Provider value={value}>{children}</BlockchainContext.Provider>
  );
};