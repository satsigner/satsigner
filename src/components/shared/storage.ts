import { WalletStore } from 'react-native-bdk';

import { Account } from '../../models/Account';

export class Storage {

  private walletStore: WalletStore;

  constructor() {
    this.walletStore = new WalletStore();
  }

  async getAccountsFromStorage(): Promise<Account[]> {
    this.walletStore = new WalletStore();

    const loaded = await this.walletStore.loadFromDisk();
    if (! loaded) {
      console.error('Error loading accounts from wallet store');
      return [];
    }
  
    return this.walletStore.getWallets() as Account[];
  }

  async storeAccount(account: Account): Promise<void> {
    this.walletStore.wallets.push(account as any);
    await this.walletStore.saveToDisk();
  }

  async updateAccount(account: Account): Promise<void> {
    const walletIndex = this.walletStore.wallets.findIndex(
      wallet => {
        const walletAccount = wallet as Account;
        return walletAccount.name === account.name &&
          walletAccount.external_descriptor === account.external_descriptor &&
          walletAccount.internal_descriptor === account.internal_descriptor;
      }
    );
    if (walletIndex !== -1) {
      this.walletStore.wallets[walletIndex] = account as any;
      await this.walletStore.saveToDisk();  
    }
  }
}
