import { useState } from "react";

import { BlockchainContext } from "./BlockchainContext";
import { Backend } from "../../enums/Backend";
import { Network } from "../../enums/Network";
import { BlockChainNames, BlockchainElectrumConfig, BlockchainEsploraConfig } from "bdk-rn/lib/lib/enums";
import { Blockchain } from "bdk-rn";

// use 'encrypted' getItem / setItem to presist values

export const BlockchainProvider = ({ children }) => {
  const [ backend, setBackend ] = useState(Backend.Esplora);
  const [ network, setNetwork ] = useState(Network.Signet);

  // ssl://electrum.blockstream.info:60002
  // https://mutinynet.com/api
  const [ url, setUrl ] = useState('https://mutinynet.com/api');

  const getBlockchainConfig = (): BlockchainElectrumConfig | BlockchainEsploraConfig => {
    switch (backend) {
      case Backend.Electrum:
        return {
          url,
          sock5: null,
          retry: 5,
          timeout: 5,
          stopGap: 20,
          validateDomain: false
        };
      case Backend.Esplora:
        return {
          baseUrl: url,
          timeout: 5,
          stopGap: 20,
          proxy: null,
          concurrency: 4
        };
    }
  }

  const getBlockchain = async(): Promise<Blockchain> => {
    const config = getBlockchainConfig();

    return await new Blockchain().create(
      config,
      backend as unknown as BlockChainNames
    );
  }

  const value = {
    backend,
    setBackend,
    network,
    setNetwork,
    url,
    setUrl,
    getBlockchain
  };

  return (
    <BlockchainContext.Provider value={value}>{children}</BlockchainContext.Provider>
  );
};