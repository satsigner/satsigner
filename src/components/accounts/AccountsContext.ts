import { createContext } from 'react';
import Account from '../../models/Account';

export const AccountsContext = createContext({
  currentAccount: null,
  setCurrentAccount: (account: Account) => {},
});
