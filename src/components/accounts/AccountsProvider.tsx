import React from 'react';
import { AccountsContext } from "./AccountsContext";
import Account from '../../models/Account';

import { 
  Bdk,
  LoadWalletResponse
} from 'react-native-bdk';

import { Result } from '@synonymdev/result';

import WalletStore from 'react-native-bdk/src/store/walletstore';

import { SeedWords } from '../../enums/SeedWords';
import { ScriptVersion } from '../../enums/ScriptVersion';

export const AccountsProvider = ({ children }) => {

  const accountsStoreKey = 'ACCOUNTS';

  const electrumUrl = 'ssl://electrum.blockstream.info:60002';

  const [walletStore, setWalletStore] = React.useState<WalletStore>(new WalletStore());
  
  const [accounts, setAccounts] = React.useState<Account[]>([
    {
      name: 'Account #1',
      seedWords: SeedWords.WORDS12,
      scriptVersion: ScriptVersion.P2WPKH
    }
  ]);
  const [account, setAccount] = React.useState(new Account());

  const addAccount = (account: Account) => setAccounts([...accounts, account]);
  
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

    const { descriptor_external, descriptor_internal } = response.value;

    await storeWallet(descriptor_external, descriptor_internal);
    await storeAccount(descriptor_external, account.name, account.scriptVersion as ScriptVersion);
    
    // const synced = await wallet.sync();
    // console.log('wallet sync', synced);

    // await saveWalletToDisk(wallet);

    // const balance = await wallet.getBalance();
    // console.log('balance', JSON.stringify(balance));

    // const address = await wallet.getAddress(AddressIndexVariant.NEW, 0);
    // console.log('new address', JSON.stringify(address));

    // const transactions = await wallet.listTransactions();
    // console.log('transactions', transactions);
    
    // return wallet;
  }

  const storeWallet = async (externalDescriptor: string, internalDescriptor: string) => {
    walletStore.wallets.push({
      external_descriptor: externalDescriptor,
      internal_descriptor: internalDescriptor
    });
    await walletStore.saveToDisk();
  };

  const storeAccount = async (externalDescriptor: string, name: string, scriptVersion: ScriptVersion) => {
    let accountsString = await walletStore.getItem(accountsStoreKey);
    if (accountsString) {
      let accounts: { [key: string]: { name: string, scriptVersion: ScriptVersion } };
      try {
        accounts = JSON.parse(accountsString);
      } catch (err) {
        console.error(err);
        throw new Error('Error loading stored accounts');
      }

      accounts[externalDescriptor] = { name, scriptVersion };
      accountsString = JSON.stringify(accounts);

      await walletStore.setItem(accountsStoreKey, accountsString);
    }
  };

  const loadWalletsFromDisk = async(): Promise<void> => {
    await walletStore.loadFromDisk();
  }

  const value = {
    accounts,
    currentAccount: account,
    setCurrentAccount,
    addAccount,
    loadWalletFromMnemonic
  };

  return (
    <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
  );
};