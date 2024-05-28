import { LocalUtxo, TransactionDetails } from "bdk-rn/lib/classes/Bindings";
import { Network } from '../../enums/Network';

import getAddress from "../shared/getAddress";
import { Keychain, Utxo } from "../../models/Utxo";

export default async function toUtxo(utxo: LocalUtxo, transactions: TransactionDetails[], network: Network): Promise<Utxo> {
  const addressTo = await getAddress(utxo, network);
  const txid = utxo?.outpoint.txid;
  const txnDetails = getTransaction(txid, transactions);

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

function getTransaction(txid: string, transactions: TransactionDetails[]): TransactionDetails | undefined {
  return transactions.find(txn => txn.txid === txid);
}

// TODO - remove after we've implemented labeling in app
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