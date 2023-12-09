import React from 'react';
import { AccountsContext } from "./AccountsContext";
import Account from '../../models/Account';

import { Bdk, Network } from 'react-native-bdk';
import { SeedWords } from '../../enums/SeedWords';
import { ScriptVersion } from '../../enums/ScriptVersion';

export const AccountsProvider = ({ children }) => {
  const [accounts, setAccounts] = React.useState<Account[]>([
    {
      name: 'Parent Account',
      seedWords: SeedWords.WORDS12,
      scriptVersion: ScriptVersion.P2WPKH
    },
    {
      name: 'Shared Account',
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