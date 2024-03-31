import { TransactionDetails } from "bdk-rn/lib/classes/Bindings";
import { Transaction, TransactionType } from "../../models/Transaction";

export class TransactionAdapter {
  static toTransaction(txnDetails: TransactionDetails): Transaction {
    return {
      type: txnDetails.sent ? TransactionType.Send : TransactionType.Receive,
      sent: txnDetails.sent,
      received: txnDetails.received
    }
  }
}
