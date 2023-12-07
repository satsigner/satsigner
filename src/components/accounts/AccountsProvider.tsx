import React from 'react';
import { AccountsContext } from "./AccountsContext";
import Account from '../../models/Account';

export const AccountsProvider = ({ children }) => {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [account, setAccount] = React.useState(new Account());

  const addAccount = (account: Account) => setAccounts([...accounts, account]);
  const setCurrentAccount = (account: Account) => {
    account.name = account.name.trim();
    setAccount(account);
  };

  const value = {
    accounts,
    currentAccount: account,
    setCurrentAccount,
    addAccount
  };

  return (
    <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
  );
};