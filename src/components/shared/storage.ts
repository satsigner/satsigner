import WalletStore from 'react-native-bdk/src/store/walletstore';

import Account from '../../models/Account';

export class Storage {

  private walletStore: WalletStore;

  constructor() {
    this.walletStore = new WalletStore();
  }

  async getAccountsFromStorage(): Promise<Account[]> {
    const loaded = this.walletStore.loadFromDisk();
    if (! loaded) {
      console.error('Error loading accounts from wallet store');
      return [];
    }
  
    return await this.walletStore.getWallets() as Account[];
  }

  async storeAccount(account: Account): Promise<void> {
    this.walletStore.wallets.push(account as any);
    await this.walletStore.saveToDisk();
  }
}
