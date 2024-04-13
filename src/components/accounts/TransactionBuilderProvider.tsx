import React from 'react';

import { TransactionBuilderContext } from "./TransactionBuilderContext";

import { Utxo } from '../../models/Utxo';

export const TransactionBuilderProvider = ({ children }) => {
  
  const [inputs, setInputs] = React.useState<Map<string, Utxo>>(new Map<string, Utxo>());

  const getOutpoint = (utxo: Utxo) => `${utxo.txid}:${utxo.vout}`;

  const hasInput = (utxo: Utxo) => inputs.has(getOutpoint(utxo));

  const addInput = (utxo: Utxo): void => {
    inputs.set(getOutpoint(utxo), utxo);
  };

  const removeInput = (utxo: Utxo): boolean => {
    return inputs.delete(getOutpoint(utxo));
  };

  const value = {
    inputs,
    hasInput,
    addInput,
    removeInput
  };

  return (
    <TransactionBuilderContext.Provider value={value}>{children}</TransactionBuilderContext.Provider>
  );
};