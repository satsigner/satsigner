import { createContext } from 'react';

import { Descriptor, Wallet } from 'bdk-rn';

import { Account, AccountSummary } from '../../models/Account';
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
  loadWalletFromDescriptor: async (externalDescriptor: Descriptor, internalDescriptor: Descriptor) => new Wallet(),
  getAccountSummary: async (wallet: Wallet) => new AccountSummary(),
  storeAccountWithSummary: async (summary: AccountSummary) => {},
  syncWallet: async (wallet: Wallet) => {},
  getBlockchainHeight: async () => 0
});
