import { Wallet } from 'react-native-bdk';
import { createContext } from 'react';

import { Account } from '../../models/Account';

export const AccountsContext = createContext({
  currentAccount: new Account(),
  accounts: [],
  setCurrentAccount: (account: Account) => {},
  hasAccountWithName: (name: string) => true,
  loadWalletFromMnemonic: async (mnemonic: string): Wallet => {},
  loadAccountDetails: async () => {}
});
