import z from 'zod'

import { MnemonicWordCountSchema, WordListNameSchema } from '@/types/bips/39'
import { LabelSchema } from '@/types/bips/329'
import { AddressSchema } from '@/types/models/Address'
import { NostrAccountSchema } from '@/types/models/Nostr'
import { ScriptVersionTypeSchema } from '@/types/models/Script'
import { TransactionSchema } from '@/types/models/Transaction'
import { UtxoSchema } from '@/types/models/Utxo'
import { NetworkSchema } from '@/types/settings/blockchain'

export const PolicyTypeSchema = z.enum(['singlesig', 'multisig', 'watchonly'])

export const SyncStatusSchema = z.enum([
  'unsynced',
  'synced',
  'syncing',
  'error',
  'timeout'
])

export const SyncProgressSchema = z.object({
  tasksDone: z.number(),
  totalTasks: z.number()
})

export const CreationTypeSchema = z.enum([
  'generateMnemonic',
  'importMnemonic',
  'importDescriptor',
  'importExtendedPub',
  'importAddress'
])

export const SecretSchema = z.object({
  extendedPublicKey: z.string().optional(),
  externalDescriptor: z.string().optional(),
  fingerprint: z.string().optional(),
  internalDescriptor: z.string().optional(),
  mnemonic: z.string().optional(),
  passphrase: z.string().optional()
})

export const KeyMetaSchema = z.object({
  creationType: CreationTypeSchema,
  derivationPath: z.string().optional(),
  fingerprint: z.string().optional(),
  index: z.number(),
  mnemonicWordCount: MnemonicWordCountSchema.optional(),
  mnemonicWordList: WordListNameSchema.optional(),
  name: z.string().optional(),
  scriptVersion: ScriptVersionTypeSchema.optional()
})

export const KeySchema = KeyMetaSchema.extend({
  iv: z.string(),
  secret: z.union([SecretSchema, z.string()])
})

export const DecryptedKeySchema = KeySchema.omit({ secret: true }).extend({
  secret: SecretSchema
})

export const AccountSchema = z.object({
  addresses: z.array(AddressSchema),
  createdAt: z.date(),
  id: z.string(),
  isSyncing: z.boolean().optional(),
  keyCount: z.number(),
  keys: z.array(KeySchema),
  keysRequired: z.number(),
  labels: z.record(z.string(), LabelSchema),
  lastSyncedAt: z.date().optional(),
  name: z.string(),
  network: NetworkSchema,
  nostr: NostrAccountSchema,
  policyType: PolicyTypeSchema,
  summary: z.object({
    balance: z.number(),
    numberOfAddresses: z.number(),
    numberOfTransactions: z.number(),
    numberOfUtxos: z.number(),
    satsInMempool: z.number()
  }),
  syncProgress: SyncProgressSchema.optional(),
  syncStatus: SyncStatusSchema,
  transactions: z.array(TransactionSchema),
  utxos: z.array(UtxoSchema)
})

export const DecryptedAccountSchema = AccountSchema.omit({ keys: true }).extend(
  {
    keys: z.array(DecryptedKeySchema)
  }
)

export type Account = z.infer<typeof AccountSchema>
export type CreationType = z.infer<typeof CreationTypeSchema>
export type DecryptedAccount = z.infer<typeof DecryptedAccountSchema>
export type DecryptedKey = z.infer<typeof DecryptedKeySchema>
export type Key = z.infer<typeof KeySchema>
export type KeyMeta = z.infer<typeof KeyMetaSchema>
export type PolicyType = z.infer<typeof PolicyTypeSchema>
export type Secret = z.infer<typeof SecretSchema>
export type SyncProgress = z.infer<typeof SyncProgressSchema>
export type SyncStatus = z.infer<typeof SyncStatusSchema>
