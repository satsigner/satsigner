import { useEffect, useState } from "react";

import { Blockchain } from "bdk-rn";
import { BlockChainNames, BlockchainElectrumConfig, BlockchainEsploraConfig } from "bdk-rn/lib/lib/enums";
import * as encrypted from '../shared/encrypted';

import { BlockchainContext } from "./BlockchainContext";
import { Backend } from "../../enums/Backend";
import { Network } from "../../enums/Network";

const BACKEND = 'config.blockchain.backend';
const NETWORK = 'config.blockchain.network';
const URL = 'config.blockchain.url';

export const BlockchainProvider = ({ children }) => {
  const defaultBackend = Backend.Esplora;
  const defaultNetwork = Network.Signet;
  // ssl://electrum.blockstream.info:60002
  // https://mutinynet.com/api
  const defaultUrl = 'https://mutinynet.com/api';

  const [ backend, setBackendState ] = useState(defaultBackend);
  const [ network, setNetworkState ] = useState(defaultNetwork);
  const [ url, setUrlState ] = useState(defaultUrl);

  useEffect(() => {
    encrypted.getItem(BACKEND)
        .then(backend => setBackendState(backend as unknown as Backend || defaultBackend));
    encrypted.getItem(NETWORK)
      .then(network => setNetworkState(network as unknown as Network || defaultNetwork));
    encrypted.getItem(URL)
      .then(url => setUrlState(url || defaultUrl));
  }, []);

  const setBackend = (backend: Backend): Promise<void> => {
    setBackendState(backend);
    return encrypted.setItem(BACKEND, backend);
  }

  const setNetwork = (network: Network): Promise<void> => {
    setNetworkState(network);
    return encrypted.setItem(NETWORK, network);
  }

  const setUrl = (url: string): Promise<void> => {
    setUrlState(url);
    return encrypted.setItem(URL, url);
  }

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