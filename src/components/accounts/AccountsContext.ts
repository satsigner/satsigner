import { createContext } from 'react';
import Account from '../../models/Account';

export const AccountsContext = createContext({
  currentAccount: new Account(),
  accounts: [],
  setCurrentAccount: (account: Account) => {},
  addAccount: (account: Account) => {},
  loadWallet: async (mnemonic: string) => {}
});
