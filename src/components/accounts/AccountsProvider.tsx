import React from 'react';
import { 
  Bdk,
  LoadWalletResponse
} from 'react-native-bdk';

import { Result } from '@synonymdev/result';

import { Storage } from '../shared/storage';
import { AccountsContext } from "./AccountsContext";
import { Account } from '../../models/Account';

export const AccountsProvider = ({ children }) => {

  const electrumUrl = 'ssl://electrum.blockstream.info:60002';

  const [storage, setStorage] = React.useState<Storage>(new Storage());
  
  const [accounts, setAccounts] = React.useState<Account[]>([]);

  React.useEffect(() => {
    storage.getAccountsFromStorage().then(accounts => setAccounts(accounts))
  }, []);

  const [account, setAccount] = React.useState(new Account());

  const hasAccountWithName = (name: string) => !! accounts.find(a => name === a.name);

  const hasAccountWithDescriptor = (externalDescriptor: string, internalDescriptor: string) =>
    !! accounts.find(a => externalDescriptor === a.external_descriptor) ||
    !! accounts.find(a => internalDescriptor === a.internal_descriptor);

  const setCurrentAccount = (account: Account) => {
    account.name = account.name.trim();
    setAccount(account);
  };

  const loadWalletFromMnemonic = async(mnemonic: string): Promise<void> => {
    
    // await Bdk.unloadWallet();
    const response: Result<LoadWalletResponse> = await Bdk.loadWallet({
      mnemonic,
      config: {
        network: 'testnet',
        blockchainConfigUrl: electrumUrl
      }
    });
    console.log('loadWallet', response);

    if (response.isErr()) {
      throw new Error('Loading wallet failed');
    }

    account.external_descriptor = response.value.descriptor_external;
    account.internal_descriptor = response.value.descriptor_internal;

    if (hasAccountWithName(account.name)) {
      throw new Error('Account with that name already exists');
    } else if (hasAccountWithDescriptor(account.external_descriptor as string, account.internal_descriptor as string)) {
      throw new Error('Account with that mnemonic already exists');
    } else {
      await storeAccount(account);
    }
  }

  const storeAccount = async (account: Account) => {
    console.log('accounts before storing', accounts);

    storage.storeAccount(account);

    setAccounts(await storage.getAccountsFromStorage());

    console.log('accounts after storing', accounts);
  };

  const value = {
    accounts,
    currentAccount: account,
    setCurrentAccount,
    hasAccountWithName,
    loadWalletFromMnemonic
  };

  return (
    <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
  );
};