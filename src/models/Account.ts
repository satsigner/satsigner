import { ScriptVersion } from "../enums/ScriptVersion";
import { SeedWords } from "../enums/SeedWords";

export class Account {
  name: string;
  seedWords?: SeedWords;
  scriptVersion?: ScriptVersion;
  external_descriptor?: string;
  internal_descriptor?: string;
  snapshot: WalletSnapshot;
}

export class WalletSnapshot {
  balanceSats: number;
  balanceUsd: number;
  numAddresses: number;
  numTransactions: number;
  numUtxos: number;
  satsInMempool: number;
}