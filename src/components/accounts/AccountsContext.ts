import { createContext } from 'react';

import { Wallet } from 'bdk-rn';

import { Account, AccountSnapshot } from '../../models/Account';
import { SeedWordCount } from '../../enums/SeedWordCount';
import { ScriptVersion } from '../../enums/ScriptVersion';

export const AccountsContext = createContext({
  currentAccount: new Account(),
  accounts: [],
  setCurrentAccount: (account: Account) => {},
  hasAccountWithName: (name: string) => {},
  getFingerprint: async (mnemonic: string, passphrase: string) => {},
  generateMnemonic: async(count: SeedWordCount) => '',
  loadWalletFromMnemonic: async (mnemonic: string, passphrase: string, scriptVersion: ScriptVersion) => new Wallet(),
  getAccountSnapshot: async (wallet: Wallet) => new AccountSnapshot(),
  storeAccountWithSnapshot: async (snapshot: AccountSnapshot) => {},
  syncWallet: async (wallet: Wallet) => {}
});
