import { LocalUtxo, TransactionDetails } from "bdk-rn/lib/classes/Bindings";

import { Transaction, TransactionType } from "../../models/Transaction";
import getAddress from "../shared/getAddress";
import { Network } from '../../enums/Network';

export default async function toTransaction(txnDetails: TransactionDetails, utxos: LocalUtxo[], network: Network): Promise<Transaction> {
  const txnUtxos = getTransactionUtxos(txnDetails.txid, utxos);
  let address = '';
  const utxo = txnUtxos?.[0];
  if (utxo) {
    address = await getAddress(utxo, network);
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

function getTransactionUtxos(txid: string, utxos: LocalUtxo[]): LocalUtxo[] {
  return utxos.filter(utxo => utxo?.outpoint?.txid === txid);
}
