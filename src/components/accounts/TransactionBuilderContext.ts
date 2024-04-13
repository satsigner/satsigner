import { createContext } from 'react';

import { Utxo } from '../../models/Utxo';

export const TransactionBuilderContext = createContext({
  inputs: [],
  hasInput: (utxo: Utxo) => false,
  addInput: (utxo: Utxo) => {},
  removeInput: (utxo: Utxo) => {}
});
