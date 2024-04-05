import { LocalUtxo, TransactionDetails } from "bdk-rn/lib/classes/Bindings";

import { Transaction, TransactionType } from "../../models/Transaction";
import getAddress from "../shared/getAddress";
import { Network } from "bdk-rn/lib/lib/enums";

export class TransactionAdapter {
  static async toTransaction(txnDetails: TransactionDetails, utxos: LocalUtxo[]): Promise<Transaction> {
    const txnUtxos = TransactionAdapter.getTransactionUtxos(txnDetails.txid, utxos);
    let address = '';
    const utxo = txnUtxos?.[0];
    if (utxo) {
      address = await getAddress(utxo, Network.Testnet);
    }

    return {
      txid: txnDetails.txid,
      type: txnDetails.sent ? TransactionType.Send : TransactionType.Receive,
      sent: txnDetails.sent,
      received: txnDetails.received,
      timestamp: txnDetails.confirmationTime?.timestamp ?
        new Date(txnDetails.confirmationTime?.timestamp * 1000) :
        undefined,
      blockHeight: txnDetails.confirmationTime?.height,
      memo: undefined,
      address
    }
  }

  static getTransactionUtxos(txid: string, utxos: LocalUtxo[]): LocalUtxo[] {
    return utxos.filter(utxo => utxo?.outpoint?.txid === txid);
  }
}
