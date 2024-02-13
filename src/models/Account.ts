import { ScriptVersion } from "../enums/ScriptVersion";
import { SeedWords } from "../enums/SeedWords";

export class Account {
  name: string;
  seedWords?: SeedWords;
  scriptVersion?: ScriptVersion;
  external_descriptor?: string;
  internal_descriptor?: string;
  fingerprint?: string;
  derivationPath?: string;
  snapshot: AccountSnapshot;
}

export class AccountSnapshot {
  balanceSats: number;
  balanceUsd: number;
  numAddresses: number;
  numTransactions: number;
  numUtxos: number;
  satsInMempool: number;
}