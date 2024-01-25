import { createContext } from 'react';

import { Wallet } from 'bdk-rn';

import { Account, AccountSnapshot } from '../../models/Account';

export const AccountsContext = createContext({
  currentAccount: new Account(),
  accounts: [],
  setCurrentAccount: (account: Account) => {},
  hasAccountWithName: (name: string) => {},
  loadWalletFromMnemonic: async (mnemonic: string, passphrase: string) => {},
  getAccountSnapshot: async (wallet: Wallet) => {},
  storeAccountSnapshot: async (snapshot: AccountSnapshot) => {}
});
