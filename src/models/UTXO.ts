export class UTXO {
  txid: string;
  vout: number;
  value: number;
  timestamp?: Date;
  label?: string;
  addressTo?: string;
  keychain: Keychain;
}

export enum Keychain {
  Internal,
  External
}
