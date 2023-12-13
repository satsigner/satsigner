import React from 'react';
import { AccountsContext } from "./AccountsContext";
import Account from '../../models/Account';

import { Wallet, ElectrumConfig, Blockchain, AddressIndexVariant } from 'react-native-bdk';
import { SeedWords } from '../../enums/SeedWords';
import { ScriptVersion } from '../../enums/ScriptVersion';

export const AccountsProvider = ({ children }) => {

  const electrumConfig: ElectrumConfig = {
    url: 'ssl://electrum.blockstream.info:60002',
    retry: '',
    timeout: '',
    stopGap: '',
  };

  const [blockchain, setBlockchain] = React.useState<Blockchain>(null);
  
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

  const initBlockchain = async(): Promise<void> => {
    const blockchain = await Blockchain.create(electrumConfig);
    const height = await blockchain.getHeight()
    console.log('blockchain height', height);
    setBlockchain(blockchain);
  }

  const loadWallet = async(mnemonic: string): Promise<Wallet> => {
    const wallet = await Wallet.init({mnemonic});
    console.log('wallet', wallet);

    console.log('wallet sync', await wallet.sync());

    const balance = await wallet.getBalance();
    console.log('balance', JSON.stringify(balance));

    const address = await wallet.getAddress(AddressIndexVariant.NEW, 0);
    console.log('new address', JSON.stringify(address));

    // const transactions = await wallet.listTransactions();
    // console.log('transactions', transactions);
    
    return wallet;
  }

  initBlockchain();

  const value = {
    accounts,
    currentAccount: account,
    setCurrentAccount,
    addAccount,
    loadWallet,
    initBlockchain,
    blockchain
  };

  return (
    <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
  );
};