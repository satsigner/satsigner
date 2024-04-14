export class Transaction {
  txid: string;
  type: TransactionType;
  sent = 0;
  received = 0;
  timestamp?: Date;
  blockHeight?: number;
  memo?: string;
  address?: string;
}

export enum TransactionType {
  Send,
  Receive
}
