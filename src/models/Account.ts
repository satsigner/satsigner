import { AccountCreationType } from "../enums/AccountCreationType";
import { ScriptVersion } from "../enums/ScriptVersion";
import { SeedWordCount } from "../enums/SeedWordCount";
import { Transaction } from "./Transaction";
import { Utxo } from "./Utxo";

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
  transactions: Transaction[] = [];
  utxos: Utxo[] = [];
  summary: AccountSummary;
}

export class AccountSummary {
  balanceSats = 0;
  numAddresses = 0;
  numTransactions = 0;
  numUtxos = 0;
  satsInMempool = 0;
}