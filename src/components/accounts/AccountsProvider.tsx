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
  AddressIndex,
  WordCount
} from 'bdk-rn/lib/lib/enums';

import { blockchainElectrumConfig } from '../../config';

import { Storage } from '../shared/storage';
import { AccountsContext } from "./AccountsContext";
import { Account, AccountSnapshot } from '../../models/Account';

import { SeedWordCount } from '../../enums/SeedWordCount';
import { ScriptVersion } from '../../enums/ScriptVersion';
import { TransactionAdapter } from './TransactionAdapter';

export const AccountsProvider = ({ children }) => {

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

  const getFingerprint = async(mnemonicString: string, passphrase = ''): Promise<string> => {
    try {
      const mnemonic = await new Mnemonic().fromString(mnemonicString);
      const descriptorSecretKey = await new DescriptorSecretKey().create(
        Network.Testnet,
        mnemonic,
        passphrase
      );
      const descriptor = await new Descriptor().newBip84(descriptorSecretKey, KeychainKind.External, Network.Testnet);
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
      Network.Testnet,
      mnemonic,
      passphrase
    );

    switch (scriptVersion) {
      case ScriptVersion.P2PKH:
        return await new Descriptor().newBip44(descriptorSecretKey, kind, Network.Testnet);
      case ScriptVersion.P2SH_P2WPKH:
        return await new Descriptor().newBip49(descriptorSecretKey, kind, Network.Testnet);
      case ScriptVersion.P2WPKH:
        return await new Descriptor().newBip84(descriptorSecretKey, kind, Network.Testnet);
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

    const dbConfig = await new DatabaseConfig().memory();

    const wallet = await new Wallet().create(
      externalDescriptor,
      internalDescriptor,
      Network.Testnet,
      dbConfig
    );

    return wallet;
  };

  const syncWallet = async(wallet: Wallet): Promise<void> => {
    const blockchain = await new Blockchain().create(blockchainElectrumConfig);
    await wallet.sync(blockchain);
  };

  const storeAccount = async (account: Account) => {
    await storage.storeAccount(account);
    setCurrentAccount(account);

    setAccounts(await storage.getAccountsFromStorage());
  };

  const updateAccount = async (account: Account) => {
    await storage.updateAccount(account);
    setCurrentAccount(account);

    setAccounts(await storage.getAccountsFromStorage());
  };

  const getAccountSnapshot = async(wallet: Wallet): Promise<AccountSnapshot> => {
    const snapshot: AccountSnapshot = new AccountSnapshot();

    const balance = await wallet.getBalance();
    snapshot.balanceSats = balance.confirmed;

    const addressInfo = await wallet.getAddress(AddressIndex.New);
    const numAddresses = addressInfo.index + 1;
    snapshot.numAddresses = numAddresses;

    const transactions = await wallet.listTransactions(false);
    snapshot.numTransactions = transactions.length;
    console.log('transactions', JSON.stringify(transactions));

    const utxos = await wallet.listUnspent();
    snapshot.numUtxos = utxos.length;
    console.log('utxos', JSON.stringify(utxos));

    snapshot.transactions = await Promise.all(
      (transactions || []).map(
        txnDetails => TransactionAdapter.toTransaction(txnDetails, utxos)
      )
    );

    snapshot.satsInMempool = balance.trustedPending + balance.untrustedPending;

    return snapshot;
  };

  const storeAccountWithSnapshot = async(snapshot: AccountSnapshot) => {
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
    getAccountSnapshot,
    storeAccountWithSnapshot,
    syncWallet
  };

  return (
    <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
  );
};