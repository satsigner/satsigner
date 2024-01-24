// From https://github.com/xsats/react-native-bdk/blob/master/src/store/walletstore.ts

import * as encrypted from './encrypted';

const WALLETS = 'bdk.wallets';

interface Wallet {
  external_descriptor: string;
  internal_descriptor: string;
}

class WalletStore {
  wallets: Wallet[];
  tx_metadata: {};
  constructor() {
    this.wallets = [];
    this.tx_metadata = {};
  }

  /**
   * Wrapper for storage call.
   *
   * @param key
   * @param value
   * @returns {Promise<any>|Promise<any> | Promise<void> | * | Promise | void}
   */
  setItem(key: string, value: string) {
    return encrypted.setItem(key, value);
  }

  /**
   * Wrapper for storage call.
   *
   * @param key
   * @returns {Promise<any>|*}
   */
  getItem(key: string) {
    return encrypted.getItem(key);
  }

  /**
   * Load all wallets from disk and
   * maps them to `this.wallets`
   *
   * @returns {Promise.<boolean>}
   */
  async loadFromDisk() {
    try {
      let data = await this.getItem(WALLETS);
      if (data !== null) {
        console.log('typeof', typeof(data));
        console.log('data', data);
        const wallets: Wallet[] = JSON.parse(data);
        if (!wallets) return false;
        wallets.forEach((wallet) => this.wallets.push(wallet));
        return true;
      } else {
        return false; // failed loading data or loading/decryptin data
      }
    } catch (error: any) {
      console.log(error);
      console.warn(error.message);
      return false;
    }
  }

  /**
   * Retrieve wallet from store via external_descriptor and
   * remove from `this.wallets`
   *
   * @param wallet {Wallet}
   */
  deleteWallet(wallet: Wallet) {
    const privateDescriptor = wallet.external_descriptor;
    const tempWallets: Wallet[] = [];

    for (const value of this.wallets) {
      if (value.external_descriptor === privateDescriptor) {
        // the one we should delete
        // nop
      } else {
        // the one we must keep
        tempWallets.push(value);
      }
    }
    this.wallets = tempWallets;
  }

  /**
   * Saves wallet store to disk.
   *
   * @returns {Promise} Result of storage save
   */
  async saveToDisk() {
    return this.setItem(WALLETS, JSON.stringify(this.wallets));
  }

  /**
   * Fetch all wallets in `this.wallets`
   * @returns {Array.<AbstractWallet>}
   */
  getWallets() {
    return this.wallets;
  }
}

export default WalletStore;
