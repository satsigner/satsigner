import React from 'react';
import { 
  Bdk,
  LoadWalletResponse,
  Wallet,
  AddressInfo,
  AddressIndexVariant
} from 'react-native-bdk';

import { Result } from '@synonymdev/result';

import { Storage } from '../shared/storage';
import { AccountsContext } from "./AccountsContext";
import { Account, AccountSnapshot } from '../../models/Account';

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
    }
  }

  const storeAccount = async (account: Account) => {
    await storage.storeAccount(account);

    setAccounts(await storage.getAccountsFromStorage());
  };

  const updateAccount = async (account: Account) => {
    await storage.updateAccount(account);

    setAccounts(await storage.getAccountsFromStorage());
  };

  const getAccountSnapshot = async() => {
    const snapshot: AccountSnapshot = new AccountSnapshot();

    if (await Wallet.sync()) {
      const balance = await Wallet.getBalance();
      snapshot.balanceSats = balance.confirmed;
      snapshot.balanceUsd = satsToUsd(balance.confirmed);
      const addressResult: Result<AddressInfo> = await Bdk.getAddress({ indexVariant: AddressIndexVariant.NEW, index: 0 });
      const numAddresses = addressResult.isOk() ? addressResult.value.index + 1 : 0;
      snapshot.numAddresses = numAddresses;
      const transactions = await Wallet.listTransactions()
      snapshot.numTransactions = transactions.length;
      const utxosResult = await Bdk.listUnspent();
      const numUtxos = utxosResult.isOk() ? utxosResult.value.length : 0;      
      snapshot.numUtxos = numUtxos;
      const satsInMempool = balance.trustedPending + balance.untrustedPending;
      snapshot.satsInMempool = satsInMempool;
    }

    return snapshot;
  };

  const storeAccountSnapshot = async(snapshot: AccountSnapshot) => {
    if (hasAccountWithName(account.name) &&
      hasAccountWithDescriptor(
        account.external_descriptor as string,
        account.internal_descriptor as string
      )
    ) {
      account.snapshot = snapshot;
      await updateAccount(account);
    } else {
      account.snapshot = snapshot;
      await storeAccount(account);
    }
  };

  // TEMP hardcode
  const satsToUsd = (sats: number): number => {
    return sats / 100_000_000 * 45_000;
  };
  
  const value = {
    currentAccount: account,
    accounts,
    setCurrentAccount,
    hasAccountWithName,
    loadWalletFromMnemonic,
    getAccountSnapshot,
    storeAccountSnapshot
  };

  return (
    <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
  );
};