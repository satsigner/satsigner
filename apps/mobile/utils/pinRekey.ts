import { z } from 'zod'

import { PIN_KEY, PIN_REKEY_JOURNAL_KEY } from '@/config/auth'
import {
  deleteItem,
  getItem,
  getKeySecret,
  getLndConfigSecret,
  getNostrAccountSecret,
  getNostrIdentitySecret,
  getRpcCredentialsSecret,
  setItem,
  storeKeySecret,
  storeLndConfigSecret,
  storeNostrAccountSecret,
  storeNostrIdentitySecret,
  storeRpcCredentialsSecret
} from '@/storage/encrypted'
import type { Account, EncryptedKeySecret } from '@/types/models/Account'
import { NetworkSchema } from '@/types/settings/blockchain'
import { assertNever } from '@/utils/assertNever'
import { aesDecrypt, aesEncrypt, randomIv } from '@/utils/crypto'
import { applyPendingPinKdfCommit } from '@/utils/pinKdf'

const PinSecretSlotSchema = z.discriminatedUnion('kind', [
  z.object({
    accountId: z.string(),
    keyIndex: z.number().int().nonnegative(),
    kind: z.literal('accountKey')
  }),
  z.object({ kind: z.literal('nostrIdentity'), npub: z.string() }),
  z.object({ accountId: z.string(), kind: z.literal('nostrAccount') }),
  z.object({ kind: z.literal('lndConfig') }),
  z.object({ kind: z.literal('rpcCredentials'), network: z.string() })
])

/**
 * Written before any secret moves to the new digest and cleared once the new
 * digest is committed, so an interrupted PIN change can be undone on the next
 * launch instead of leaving secrets under a digest the app never derives.
 */
const PinRekeyJournalSchema = z.object({
  fromDigest: z.string().min(1),
  slots: z.array(PinSecretSlotSchema),
  toDigest: z.string().min(1)
})

type PinSecretSlot = z.infer<typeof PinSecretSlotSchema>
type PinRekeyJournal = z.infer<typeof PinRekeyJournalSchema>
type UnreadableSecret = 'abort' | 'skip'
type PendingSecretWrite = { plaintext: string; slot: PinSecretSlot }

function accountKeySlot(accountId: string, keyIndex: number): PinSecretSlot {
  return { accountId, keyIndex, kind: 'accountKey' }
}

function nostrIdentitySlot(npub: string): PinSecretSlot {
  return { kind: 'nostrIdentity', npub }
}

function nostrAccountSlot(accountId: string): PinSecretSlot {
  return { accountId, kind: 'nostrAccount' }
}

function rpcCredentialsSlot(network: string): PinSecretSlot {
  return { kind: 'rpcCredentials', network }
}

/** Every secret encrypted under the PIN digest. */
function listPinSecretSlots(
  accounts: Pick<Account, 'id' | 'keys'>[],
  identityNpubs: string[]
): PinSecretSlot[] {
  return [
    ...accounts.flatMap((account) =>
      account.keys.map((_, keyIndex) => accountKeySlot(account.id, keyIndex))
    ),
    ...identityNpubs.map(nostrIdentitySlot),
    ...accounts.map((account) => nostrAccountSlot(account.id)),
    { kind: 'lndConfig' },
    ...NetworkSchema.options.map(rpcCredentialsSlot)
  ]
}

function readSlot(slot: PinSecretSlot): Promise<EncryptedKeySecret | null> {
  switch (slot.kind) {
    case 'accountKey': {
      return getKeySecret(slot.accountId, slot.keyIndex)
    }
    case 'nostrIdentity': {
      return getNostrIdentitySecret(slot.npub)
    }
    case 'nostrAccount': {
      return getNostrAccountSecret(slot.accountId)
    }
    case 'lndConfig': {
      return getLndConfigSecret()
    }
    case 'rpcCredentials': {
      return getRpcCredentialsSecret(slot.network)
    }
    default: {
      return assertNever(slot)
    }
  }
}

function writeSlot(
  slot: PinSecretSlot,
  { iv, secret }: EncryptedKeySecret
): Promise<void> {
  switch (slot.kind) {
    case 'accountKey': {
      return storeKeySecret(slot.accountId, slot.keyIndex, secret, iv)
    }
    case 'nostrIdentity': {
      return storeNostrIdentitySecret(slot.npub, secret, iv)
    }
    case 'nostrAccount': {
      return storeNostrAccountSecret(slot.accountId, secret, iv)
    }
    case 'lndConfig': {
      return storeLndConfigSecret(secret, iv)
    }
    case 'rpcCredentials': {
      return storeRpcCredentialsSecret(slot.network, secret, iv)
    }
    default: {
      return assertNever(slot)
    }
  }
}

/** Every PIN-bound plaintext is JSON, so a wrong digest cannot pass as right. */
async function openWithDigest(
  stored: EncryptedKeySecret,
  digest: string
): Promise<string | null> {
  try {
    const plaintext = await aesDecrypt(stored.secret, digest, stored.iv)
    JSON.parse(plaintext)
    return plaintext
  } catch {
    return null
  }
}

/**
 * Decrypts every secret still under `fromDigest` before writing anything.
 * Secrets already under `toDigest` are skipped, so a move that was cut short
 * can run again in either direction.
 */
async function planSecretMove(
  slots: PinSecretSlot[],
  fromDigest: string,
  toDigest: string,
  unreadable: UnreadableSecret
): Promise<PendingSecretWrite[]> {
  const pending: PendingSecretWrite[] = []
  for (const slot of slots) {
    const stored = await readSlot(slot)
    if (!stored) {
      continue
    }
    const plaintext = await openWithDigest(stored, fromDigest)
    if (plaintext !== null) {
      pending.push({ plaintext, slot })
      continue
    }
    const alreadyMoved = (await openWithDigest(stored, toDigest)) !== null
    if (!alreadyMoved && unreadable === 'abort') {
      throw new Error(`A ${slot.kind} secret opens with neither PIN`)
    }
  }
  return pending
}

async function moveSecrets(
  slots: PinSecretSlot[],
  fromDigest: string,
  toDigest: string,
  unreadable: UnreadableSecret
): Promise<void> {
  const pending = await planSecretMove(slots, fromDigest, toDigest, unreadable)
  for (const { plaintext, slot } of pending) {
    const iv = randomIv()
    const secret = await aesEncrypt(plaintext, toDigest, iv)
    await writeSlot(slot, { iv, secret })
  }
}

async function readPinRekeyJournal(): Promise<PinRekeyJournal | null> {
  const raw = await getItem(PIN_REKEY_JOURNAL_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = PinRekeyJournalSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function clearPinRekeyJournal(): Promise<void> {
  return deleteItem(PIN_REKEY_JOURNAL_KEY)
}

/**
 * Clears the journal only when it records a move to `toDigest`. A journal
 * left by an earlier change is the only way back for its secrets.
 */
async function clearPinRekeyJournalFor(toDigest: string): Promise<void> {
  const journal = await readPinRekeyJournal()
  if (journal?.toDigest !== toDigest) {
    return
  }
  await clearPinRekeyJournal()
}

async function rollBackPinRekey(journal: PinRekeyJournal): Promise<void> {
  await moveSecrets(journal.slots, journal.toDigest, journal.fromDigest, 'skip')
  await clearPinRekeyJournal()
}

/**
 * Finishes a PIN change cut short by a crash. Once the new digest is
 * committed every secret already moved, so only the journal is left;
 * otherwise the moved secrets go back to the digest the stored PIN opens.
 * A journaled digest commit counts as committed, so it is applied first.
 * Run before checking a PIN.
 */
async function applyPendingPinRekey(): Promise<void> {
  const journal = await readPinRekeyJournal()
  if (!journal) {
    return
  }
  await applyPendingPinKdfCommit()
  const committedDigest = await getItem(PIN_KEY)
  if (committedDigest === journal.toDigest) {
    await clearPinRekeyJournal()
    return
  }
  await rollBackPinRekey(journal)
}

/**
 * Moves every listed secret from `fromDigest` to `toDigest`, all or nothing.
 * The caller commits `toDigest` as the PIN digest and then calls
 * `clearPinRekeyJournal`; until then a crash rolls the move back.
 */
async function rekeyPinSecrets(
  fromDigest: string,
  toDigest: string,
  slots: PinSecretSlot[]
): Promise<void> {
  await applyPendingPinRekey()
  const journal: PinRekeyJournal = { fromDigest, slots, toDigest }
  await setItem(PIN_REKEY_JOURNAL_KEY, JSON.stringify(journal))
  try {
    await moveSecrets(slots, fromDigest, toDigest, 'abort')
  } catch (error) {
    await rollBackPinRekey(journal)
    throw error
  }
}

export {
  applyPendingPinRekey,
  clearPinRekeyJournal,
  clearPinRekeyJournalFor,
  listPinSecretSlots,
  type PinSecretSlot,
  rekeyPinSecrets
}
