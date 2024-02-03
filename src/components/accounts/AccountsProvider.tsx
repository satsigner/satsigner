import React from 'react';

import {
  DescriptorSecretKey,
  Mnemonic,
  Blockchain,
  Wallet,
  DatabaseConfig,
  Descriptor
} from 'bdk-rn';

import {
  Network,
  KeychainKind,
  BlockchainElectrumConfig,
  AddressIndex
} from 'bdk-rn/lib/lib/enums';

import { Storage } from '../shared/storage';
import { AccountsContext } from "./AccountsContext";
import { Account, AccountSnapshot } from '../../models/Account';

export const AccountsProvider = ({ children }) => {

  const blockchainElectrumConfig: BlockchainElectrumConfig = {
    url: 'ssl://electrum.blockstream.info:60002',
    sock5: null,
    retry: 5,
    timeout: 5,
    stopGap: 500,
    validateDomain: false,
  };

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

  const loadWalletFromMnemonic = async(mnemonicString: string, passphrase: string): Promise<Wallet> => {
    let externalDescriptor: Descriptor;
    let internalDescriptor: Descriptor;

    try {
      const mnemonic = await new Mnemonic().fromString(mnemonicString);
      const descriptorSecretKey = await new DescriptorSecretKey().create(
        Network.Testnet,
        mnemonic,
        passphrase
      );
      externalDescriptor = await new Descriptor().newBip84(descriptorSecretKey, KeychainKind.External, Network.Testnet);
      internalDescriptor = await new Descriptor().newBip84(descriptorSecretKey, KeychainKind.Internal, Network.Testnet);  
    } catch (err) {
      console.error(err);
      throw new Error('Loading wallet failed');
    }

    account.external_descriptor = await externalDescriptor.asString();
    account.internal_descriptor = await internalDescriptor.asString();

    if (hasAccountWithName(account.name)) {
      throw new Error('Account with that name already exists');
    } else if (hasAccountWithDescriptor(account.external_descriptor as string, account.internal_descriptor as string)) {
      throw new Error('Account with that mnemonic already exists');
    }

    const blockchain = await new Blockchain().create(blockchainElectrumConfig);
    const dbConfig = await new DatabaseConfig().memory();

    const wallet = await new Wallet().create(
      externalDescriptor,
      internalDescriptor,
      Network.Testnet,
      dbConfig
    );
    await wallet.sync(blockchain);

    return wallet;
  }

  const storeAccount = async (account: Account) => {
    await storage.storeAccount(account);

    setAccounts(await storage.getAccountsFromStorage());
  };

  const updateAccount = async (account: Account) => {
    await storage.updateAccount(account);

    setAccounts(await storage.getAccountsFromStorage());
  };

  const getAccountSnapshot = async(wallet: Wallet): Promise<AccountSnapshot> => {
    const snapshot: AccountSnapshot = new AccountSnapshot();

    const balance = await wallet.getBalance();
    snapshot.balanceSats = balance.confirmed;
    snapshot.balanceUsd = satsToUsd(balance.confirmed);

    const addressInfo = await wallet.getAddress(AddressIndex.New);
    const numAddresses = addressInfo.index + 1;
    snapshot.numAddresses = numAddresses;

    const transactions = await wallet.listTransactions(false);
    snapshot.numTransactions = transactions.length;

    const utxos = await wallet.listUnspent();
    snapshot.numUtxos = utxos.length;

    snapshot.satsInMempool = balance.trustedPending + balance.untrustedPending;

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