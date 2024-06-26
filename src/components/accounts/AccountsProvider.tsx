import React from 'react';

import {
  DescriptorSecretKey,
  Mnemonic,
  Wallet,
  DatabaseConfig,
  Descriptor
} from 'bdk-rn';

import {
  KeychainKind,
  AddressIndex,
  WordCount,
} from 'bdk-rn/lib/lib/enums';

import { Storage } from '../shared/storage';
import { AccountsContext } from "./AccountsContext";
import { Account, AccountSummary } from '../../models/Account';

import { SeedWordCount } from '../../enums/SeedWordCount';
import { ScriptVersion } from '../../enums/ScriptVersion';
import toTransaction from './toTransaction';
import toUtxo from './toUtxo';
import { useBlockchainContext } from './BlockchainContext';

export const AccountsProvider = ({ children }) => {

  const blockchainContext = useBlockchainContext();

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

  const getBlockchainHeight = async(): Promise<number> => {
    const blockchain = await blockchainContext.getBlockchain();
    return await blockchain.getHeight();
  };

  const getFingerprint = async(mnemonicString: string, passphrase = ''): Promise<string> => {
    try {
      const mnemonic = await new Mnemonic().fromString(mnemonicString);
      const descriptorSecretKey = await new DescriptorSecretKey().create(
        blockchainContext.network,
        mnemonic,
        passphrase
      );
      const descriptor = await new Descriptor().newBip84(descriptorSecretKey, KeychainKind.External, blockchainContext.network);
      const descriptorString = await descriptor.asString();
      
      const { fingerprint } = parseDescriptor(descriptorString);
      return fingerprint;
    } catch (err) {
      console.error('Loading wallet for fingerprint lookup failed');
      console.error(err);
      return '';
    }  
  };

  const parseDescriptor = (descriptor: string): {fingerprint: string, derivationPath: string} => {
    // example descriptorString: wpkh([73c5da0a/84'/1'/0']tpubDC8msFGeGuwnKG9Upg7DM2b4DaRqg3CUZa5g8v2SRQ6K4NSkxUgd7HsL2XVWbVm39yBA4LAxysQAm397zwQSQoQgewGiYZqrA9DsP4zbQ1M/0/*)#2ag6nxcd
    // capture 0=fingerprint, capture 1=derivation path
    const match = descriptor.match(/\[([0-9a-f]+)([0-9'/]+)\]/);
    if (match) {
      return {
        fingerprint: match[1],
        derivationPath: 'm' + match[2]
      };
    } else {
      return {
        fingerprint: '',
        derivationPath: ''  
      };
    }
  };

  const getDescriptor = async (
    mnemonicString: string,
    passphrase: string,
    scriptVersion: ScriptVersion,
    kind: KeychainKind
  ): Promise<Descriptor> => {
    const mnemonic = await new Mnemonic().fromString(mnemonicString);
    const descriptorSecretKey = await new DescriptorSecretKey().create(
      blockchainContext.network,
      mnemonic,
      passphrase
    );

    switch (scriptVersion) {
      case ScriptVersion.P2PKH:
        return await new Descriptor().newBip44(descriptorSecretKey, kind, blockchainContext.network);
      case ScriptVersion.P2SH_P2WPKH:
        return await new Descriptor().newBip49(descriptorSecretKey, kind, blockchainContext.network);
      case ScriptVersion.P2WPKH:
        return await new Descriptor().newBip84(descriptorSecretKey, kind, blockchainContext.network);
      case ScriptVersion.P2TR:
        throw new Error('Not implemented');
    }
  };

  const loadWalletFromMnemonic = async(mnemonicString: string, passphrase: string, scriptVersion: ScriptVersion): Promise<Wallet> => {
    let externalDescriptor: Descriptor;
    let internalDescriptor: Descriptor;

    try {
      externalDescriptor = await getDescriptor(mnemonicString, passphrase, scriptVersion, KeychainKind.External);
      internalDescriptor = await getDescriptor(mnemonicString, passphrase, scriptVersion, KeychainKind.Internal); 
    } catch (err) {
      console.error(err);
      throw new Error('Loading wallet failed.  [bdk-rn]: ' + err);
    }

    account.external_descriptor = await externalDescriptor.asString();
    account.internal_descriptor = await internalDescriptor.asString();

    const { fingerprint, derivationPath } = parseDescriptor(account.external_descriptor);
    account.fingerprint = fingerprint;
    account.derivationPath = derivationPath;

    setAccount(account);

    if (hasAccountWithName(account.name)) {
      throw new Error('Account with that name already exists');
    } else if (hasAccountWithDescriptor(account.external_descriptor as string, account.internal_descriptor as string)) {
      throw new Error('Account with that mnemonic already exists');
    }

    return await loadWalletFromDescriptor(externalDescriptor, internalDescriptor);
  };

  const loadWalletFromDescriptor = async(externalDescriptor: Descriptor, internalDescriptor: Descriptor): Promise<Wallet> => {
    const dbConfig = await new DatabaseConfig().memory();
    const wallet = await new Wallet().create(
      externalDescriptor,
      internalDescriptor,
      blockchainContext.network,
      dbConfig
    );

    return wallet;
  };

  const syncWallet = async(wallet: Wallet): Promise<void> => {
    const blockchain = await blockchainContext.getBlockchain();
    await wallet.sync(blockchain);
  };

  const createAccount = async (account: Account) => {
    await storage.storeAccount(account);
    setCurrentAccount(account);

    setAccounts(await storage.getAccountsFromStorage());
  };

  const updateAccount = async (account: Account) => {
    await storage.updateAccount(account);
    setCurrentAccount(account);

    setAccounts(await storage.getAccountsFromStorage());
  };

  const populateWalletData = async(wallet: Wallet, account: Account): Promise<void> => {
    const summary: AccountSummary = new AccountSummary();

    if (wallet) {
      const balance = await wallet.getBalance();
      summary.balanceSats = balance.confirmed;
  
      const addressInfo = await wallet.getAddress(AddressIndex.New);
      const numAddresses = addressInfo.index + 1;
      summary.numAddresses = numAddresses;
  
      const transactions = await wallet.listTransactions(false);
      summary.numTransactions = transactions.length;
      console.log('transactions', JSON.stringify(transactions));
  
      const utxos = await wallet.listUnspent();
      summary.numUtxos = utxos.length;
      console.log('utxos', JSON.stringify(utxos));
  
      summary.satsInMempool = balance.trustedPending + balance.untrustedPending;
  
      account.transactions = await Promise.all(
        (transactions || []).map(
          txnDetails => toTransaction(txnDetails, utxos, blockchainContext.network)
        )
      );
  
      account.utxos = await Promise.all(
        (utxos || []).map(
          localUtxo => toUtxo(localUtxo, transactions, blockchainContext.network)
        )
      );
    } else {
      account.transactions = [];
      account.utxos = [];
    }

    account.summary = summary;
  };

  const storeAccount = async(accountToStore: Account) => {
    if (hasAccountWithName(accountToStore.name) &&
      hasAccountWithDescriptor(
        accountToStore.external_descriptor as string,
        accountToStore.internal_descriptor as string
      )
    ) {
      await updateAccount(accountToStore);
    } else {
      await createAccount(accountToStore);
    }
  };

  const generateMnemonic = async(count: SeedWordCount): Promise<string> => {
    const mnemonic = await new Mnemonic().create(count as unknown as WordCount);
    console.log('mnemonic', mnemonic);
    return mnemonic.asString();
  };

  const value = {
    currentAccount: account,
    accounts,
    setCurrentAccount,
    hasAccountWithName,
    getFingerprint,
    generateMnemonic,
    loadWalletFromMnemonic,
    loadWalletFromDescriptor,
    populateWalletData,
    storeAccount,
    syncWallet,
    getBlockchainHeight
  };

  return (
    <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
  );
};