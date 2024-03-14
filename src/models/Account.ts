import { AccountCreationType } from "../enums/AccountCreationType";
import { ScriptVersion } from "../enums/ScriptVersion";
import { SeedWordCount } from "../enums/SeedWordCount";

export class Account {
  name: string;
  accountCreationType: AccountCreationType;
  seedWordCount?: SeedWordCount;
  seedWords?: string[];
  scriptVersion?: ScriptVersion;
  external_descriptor?: string;
  internal_descriptor?: string;
  fingerprint?: string;
  derivationPath?: string;
  snapshot: AccountSnapshot;
}

export class AccountSnapshot {
  balanceSats = 0;
  balanceUsd = 0;
  numAddresses = 0;
  numTransactions = 0;
  numUtxos = 0;
  satsInMempool = 0;
}