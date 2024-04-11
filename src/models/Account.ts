import { AccountCreationType } from "../enums/AccountCreationType";
import { ScriptVersion } from "../enums/ScriptVersion";
import { SeedWordCount } from "../enums/SeedWordCount";
import { Transaction } from "./Transaction";
import { UTXO } from "./UTXO";

export class Account {
  name: string;
  accountCreationType: AccountCreationType;
  seedWordCount?: SeedWordCount;
  seedWords?: string[];
  passphrase?: string;
  scriptVersion?: ScriptVersion;
  external_descriptor?: string;
  internal_descriptor?: string;
  fingerprint?: string;
  derivationPath?: string;
  snapshot: AccountSnapshot;
}

export class AccountSnapshot {
  balanceSats = 0;
  numAddresses = 0;
  numTransactions = 0;
  numUtxos = 0;
  satsInMempool = 0;

  transactions: Transaction[] = [];
  utxos: UTXO[] = [];
}