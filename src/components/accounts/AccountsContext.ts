import { createContext } from 'react';
import Account from '../../models/Account';

export const AccountsContext = createContext({
  currentAccount: new Account(),
  setCurrentAccount: (account: Account) => {},
});
