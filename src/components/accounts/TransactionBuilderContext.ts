import { createContext } from 'react';

import { Utxo } from '../../models/Utxo';

export const TransactionBuilderContext = createContext({
  inputs: [],
  hasInput: (utxo: Utxo) => {},
  addInput: (utxo: Utxo) => {},
  removeInput: (utxo: Utxo) => {}
});
