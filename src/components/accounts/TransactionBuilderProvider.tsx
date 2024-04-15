import { useState } from "react";

import { Utxo } from '../../models/Utxo';

import { TransactionBuilderContext } from "./TransactionBuilderContext";

export const TransactionBuilderProvider = ({ children }) => {
  
  // using object indirection so assignment creates new container object and forces re-render
  const [inputsMap, setInputsMap] = useState<{ map: Map<string, Utxo> }>({ map: new Map<string, Utxo>() });

  const getOutpoint = (utxo: Utxo) => `${utxo?.txid}:${utxo?.vout}`;

  const hasInput = (utxo: Utxo) => inputsMap.map.has(getOutpoint(utxo));

  const addInput = (utxo: Utxo): void => {
    const key = getOutpoint(utxo);
    setInputsMap(({ map }) => {
      map.set(key, utxo);
      return { map };
    });
  };

  const removeInput = (utxo: Utxo): void => {
    const key = getOutpoint(utxo);
    setInputsMap(({ map }) => {
      map.delete(key);
      return { map };
    });
  };

  const getInputs = (): Utxo[] => {
    return Array.from(inputsMap.map.values());
  }

  const value = {
    getInputs,
    hasInput,
    addInput,
    removeInput
  };

  return (
    <TransactionBuilderContext.Provider value={value}>{children}</TransactionBuilderContext.Provider>
  );
};