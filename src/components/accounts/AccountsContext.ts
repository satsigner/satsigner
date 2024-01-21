import { Wallet } from 'react-native-bdk';
import { createContext } from 'react';

import { Account, AccountSnapshot } from '../../models/Account';

export const AccountsContext = createContext({
  currentAccount: new Account(),
  accounts: [],
  setCurrentAccount: (account: Account) => {},
  hasAccountWithName: (name: string) => true,
  loadWalletFromMnemonic: async (mnemonic: string): Wallet => {},
  getAccountSnapshot: async () => new AccountSnapshot(),
  storeAccountSnapshot: async (snapshot: AccountSnapshot) => {}
});
