import { LocalUtxo, TransactionDetails } from "bdk-rn/lib/classes/Bindings";
import { Network } from "bdk-rn/lib/lib/enums";

import getAddress from "../shared/getAddress";
import { Keychain, UTXO } from "../../models/UTXO";

export class UTXOAdapter {
  static async toUTXO(utxo: LocalUtxo, transactions: TransactionDetails[]): Promise<UTXO> {
    const addressTo = await getAddress(utxo, Network.Testnet);
    const txid = utxo?.outpoint.txid;
    const txnDetails = UTXOAdapter.getTransaction(txid, transactions);

    return {
      txid,
      vout: utxo?.outpoint.vout,
      value: utxo?.txout.value,
      timestamp: txnDetails?.confirmationTime?.timestamp ?
        new Date(txnDetails.confirmationTime.timestamp * 1000) :
        undefined,
      label: getTestLabel(),
      addressTo,
      keychain: Keychain.External
    }
  }

  static getTransaction(txid: string, transactions: TransactionDetails[]): TransactionDetails | undefined {
    return transactions.find(txn => txn.txid === txid);
  }
}

// TODO - removed this after we've implemented labeling in app
const getTestLabel = (() => {
  let count = 0;

  const testLabels = [
    'Gift from Bob',
    undefined,
    undefined,
    'Payment from Alice',
    undefined,
    'Bought on Exchange.Inc',
    'Second round of drinks',
    undefined
  ];
  
  return () => testLabels[count++ % testLabels.length];
})();