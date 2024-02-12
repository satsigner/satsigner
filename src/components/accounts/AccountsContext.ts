import { createContext } from 'react';

import { Wallet } from 'bdk-rn';

import { Account, AccountSnapshot } from '../../models/Account';

export const AccountsContext = createContext({
  currentAccount: new Account(),
  accounts: [],
  setCurrentAccount: (account: Account) => {},
  hasAccountWithName: (name: string) => {},
  getFingerprint: async (mnemonic: string, passphrase: string) => {},
  loadWalletFromMnemonic: async (mnemonic: string, passphrase: string) => new Wallet(),
  getAccountSnapshot: async (wallet: Wallet) => new AccountSnapshot(),
  storeAccountWithSnapshot: async (snapshot: AccountSnapshot) => {},
  syncWallet: async (wallet: Wallet) => {},
});
