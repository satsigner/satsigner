import React from 'react';
import { 
  Bdk,
  LoadWalletResponse,
  Wallet
} from 'react-native-bdk';
import { AddressInfo } from '/Users/tom/Code/satsigner/react-native-bdk/src/utils/types';
import { AddressIndexVariant } from 'react-native-bdk/src/utils/types';

import { Result } from '@synonymdev/result';

import { Storage } from '../shared/storage';
import { AccountsContext } from "./AccountsContext";
import { Account, WalletSnapshot } from '../../models/Account';

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

    await storage.storeAccount(account);

    setAccounts(await storage.getAccountsFromStorage());

    console.log('accounts after storing', accounts);
  };

  const updateAccount = async (account: Account) => {
    console.log('accounts before updating', accounts);

    await storage.updateAccount(account);

    setAccounts(await storage.getAccountsFromStorage());

    console.log('accounts after updating', accounts);
  };

  const loadAccountDetails = async() => {
    const snapshot: WalletSnapshot = new WalletSnapshot();

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

    account.snapshot = snapshot;

    if (hasAccountWithName(account.name) &&
      hasAccountWithDescriptor(
        account.external_descriptor as string,
        account.internal_descriptor as string
      )
    ) {
      await updateAccount(account);
    }

    console.log('after load account details', account);
  };

  // TEMP hardcode
  const satsToUsd = (sats: number): number => {
    return sats / 100_000_000 * 40_000;
  };
  

  const value = {
    accounts,
    currentAccount: account,
    setCurrentAccount,
    hasAccountWithName,
    loadWalletFromMnemonic,
    loadAccountDetails
  };

  return (
    <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
  );
};