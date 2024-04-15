import { createContext, useContext } from 'react';

import { Utxo } from '../../models/Utxo';

export const TransactionBuilderContext = createContext({
  getInputs: (): Utxo[] => [],
  hasInput: (utxo: Utxo) => false,
  addInput: (utxo: Utxo) => {},
  removeInput: (utxo: Utxo) => {}
});

export const useTransactionBuilderContext = () => {
  const context = useContext(TransactionBuilderContext);
  if (context === undefined) {
    throw new Error('useTransactionBuilderContext must be used within TransactionBuilderContext Provider');
  }
  return context;
}
