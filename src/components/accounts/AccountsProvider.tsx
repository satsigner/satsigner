import React from 'react';
import { AccountsContext } from "./AccountsContext";
import Account from '../../models/Account';

import { Bdk, Network } from 'react-native-bdk';

export const AccountsProvider = ({ children }) => {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [account, setAccount] = React.useState(new Account());

  const addAccount = (account: Account) => setAccounts([...accounts, account]);
  
  const setCurrentAccount = (account: Account) => {
    account.name = account.name.trim();
    setAccount(account);
  };

  const loadWallet = async(mnemonic: string) => {
    const wallet = await Bdk.loadWallet({
      mnemonic,
      config: {
        network: Network.Testnet
      },
    });
    
    console.log('wallet', wallet);
  }

  const value = {
    accounts,
    currentAccount: account,
    setCurrentAccount,
    addAccount,
    loadWallet
  };

  return (
    <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
  );
};