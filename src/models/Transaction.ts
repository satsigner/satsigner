export class Transaction {
  type: TransactionType;
  sent = 0;
  received = 0;
}

export enum TransactionType {
  Send,
  Receive
}
