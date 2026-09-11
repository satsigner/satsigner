import { ECASH_BACKUP_VERSION } from '@/constants/ecash'
import type {
  EcashKeyset,
  EcashMint,
  EcashProof,
  EcashTransaction
} from '@/types/models/Ecash'

export type EcashBackupValidationReason = 'invalid' | 'proofs_missing'

export class EcashBackupValidationError extends Error {
  reason: EcashBackupValidationReason

  constructor(reason: EcashBackupValidationReason) {
    super(reason)
    this.name = 'EcashBackupValidationError'
    this.reason = reason
  }
}

export type ParsedEcashBackup = {
  mints: EcashMint[]
  proofs: EcashProof[]
  transactions: EcashTransaction[]
}

export type EcashBackupPayload = {
  version: string
  timestamp: string
  accountId?: string
  proofs?: EcashProof[]
  totalBalance?: number
  mints?: EcashMint[]
  transactions?: Partial<EcashTransaction>[]
}

export function collectMintUrlsForRestore(
  mints: Pick<EcashMint, 'url'>[],
  proofs: Pick<EcashProof, 'mintUrl'>[],
  extraUrl?: string
): string[] {
  const urls = new Set<string>()
  for (const mint of mints) {
    if (mint.url.length > 0) {
      urls.add(mint.url)
    }
  }
  for (const proof of proofs) {
    if (proof.mintUrl.length > 0) {
      urls.add(proof.mintUrl)
    }
  }
  const trimmedExtra = extraUrl?.trim()
  if (trimmedExtra) {
    urls.add(trimmedExtra)
  }
  return [...urls]
}

export function buildEcashBackupPayload({
  accountId,
  proofs,
  mints,
  transactions,
  includeTokenProofs,
  includeMintInformation,
  includeTransactionHistory
}: {
  accountId?: string
  proofs: EcashProof[]
  mints: EcashMint[]
  transactions: EcashTransaction[]
  includeTokenProofs: boolean
  includeMintInformation: boolean
  includeTransactionHistory: boolean
}): EcashBackupPayload {
  const data: EcashBackupPayload = {
    timestamp: new Date().toISOString(),
    version: ECASH_BACKUP_VERSION
  }

  if (accountId) {
    data.accountId = accountId
  }

  // Always persist every mint on this account so restore can scan all of them.
  data.mints = mints.map((mint) =>
    includeMintInformation
      ? {
          balance: mint.balance,
          isConnected: mint.isConnected,
          keysets: mint.keysets,
          lastSync: mint.lastSync,
          name: mint.name,
          url: mint.url
        }
      : {
          balance: mint.balance,
          isConnected: mint.isConnected,
          keysets: [],
          name: mint.name,
          url: mint.url
        }
  )

  if (includeTokenProofs) {
    data.proofs = proofs.map((proof) => ({
      C: proof.C,
      amount: proof.amount,
      id: proof.id,
      mintUrl: proof.mintUrl,
      secret: proof.secret
    }))
    data.totalBalance = proofs.reduce((sum, proof) => sum + proof.amount, 0)
  }

  if (includeTransactionHistory) {
    data.transactions = transactions.map((transaction) => ({
      amount: transaction.amount,
      id: transaction.id,
      invoice: transaction.invoice,
      memo: transaction.memo,
      mintUrl: transaction.mintUrl,
      quoteId: transaction.quoteId,
      timestamp: transaction.timestamp,
      token: transaction.token,
      tokenStatus: transaction.tokenStatus,
      type: transaction.type
    }))
  }

  return data
}

export function normalizeRestoredProofs(
  proofs: EcashProof[] | undefined,
  mints: EcashMint[] | undefined
): EcashProof[] {
  if (!proofs || proofs.length === 0) {
    return []
  }

  const mintList = mints ?? []
  const withMintUrl = proofs.filter(
    (proof) => typeof proof.mintUrl === 'string' && proof.mintUrl.length > 0
  )
  const missingMintUrl = proofs.length - withMintUrl.length

  if (missingMintUrl === 0) {
    return proofs
  }

  if (mintList.length === 1) {
    const onlyMintUrl = mintList[0].url
    return proofs.map((proof) => ({
      ...proof,
      mintUrl: proof.mintUrl || onlyMintUrl
    }))
  }

  throw new EcashBackupValidationError('invalid')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseRestoredProof(value: unknown): EcashProof | null {
  if (!isRecord(value)) {
    return null
  }
  if (
    typeof value.C !== 'string' ||
    value.C.length === 0 ||
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    typeof value.secret !== 'string' ||
    value.secret.length === 0 ||
    typeof value.amount !== 'number' ||
    !Number.isSafeInteger(value.amount) ||
    value.amount <= 0
  ) {
    return null
  }
  const mintUrl = typeof value.mintUrl === 'string' ? value.mintUrl : ''
  return {
    C: value.C,
    amount: value.amount,
    id: value.id,
    mintUrl,
    secret: value.secret
  }
}

function parseRestoredMint(value: unknown): EcashMint | null {
  if (!isRecord(value)) {
    return null
  }
  if (typeof value.url !== 'string' || value.url.length === 0) {
    return null
  }
  const keysets =
    value.keysets === undefined ? [] : parseRestoredKeysets(value.keysets)
  if (keysets === null) {
    return null
  }
  return {
    balance: typeof value.balance === 'number' ? value.balance : 0,
    isConnected:
      typeof value.isConnected === 'boolean' ? value.isConnected : true,
    keysets,
    lastSync: typeof value.lastSync === 'string' ? value.lastSync : undefined,
    name: typeof value.name === 'string' ? value.name : undefined,
    url: value.url
  }
}

function parseRestoredKeysets(value: unknown): EcashKeyset[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const keysets: EcashKeyset[] = []
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      item.id.length === 0
    ) {
      return null
    }
    if (item.unit !== 'sat' || typeof item.active !== 'boolean') {
      return null
    }
    keysets.push({ active: item.active, id: item.id, unit: 'sat' })
  }
  return keysets
}

function parseRestoredTransaction(value: unknown): EcashTransaction | null {
  if (!isRecord(value)) {
    return null
  }
  if (
    typeof value.id !== 'string' ||
    typeof value.amount !== 'number' ||
    typeof value.timestamp !== 'string' ||
    typeof value.mintUrl !== 'string' ||
    (value.type !== 'send' &&
      value.type !== 'receive' &&
      value.type !== 'mint' &&
      value.type !== 'melt')
  ) {
    return null
  }
  const tokenStatus =
    value.tokenStatus === 'unspent' ||
    value.tokenStatus === 'spent' ||
    value.tokenStatus === 'invalid' ||
    value.tokenStatus === 'pending'
      ? value.tokenStatus
      : undefined
  return {
    amount: value.amount,
    id: value.id,
    invoice: typeof value.invoice === 'string' ? value.invoice : undefined,
    memo: typeof value.memo === 'string' ? value.memo : undefined,
    mintUrl: value.mintUrl,
    quoteId: typeof value.quoteId === 'string' ? value.quoteId : undefined,
    timestamp: value.timestamp,
    token: typeof value.token === 'string' ? value.token : undefined,
    tokenStatus,
    type: value.type
  }
}

function parseObjectArray<T>(
  value: unknown,
  parseItem: (item: unknown) => T | null
): T[] {
  if (!Array.isArray(value)) {
    throw new EcashBackupValidationError('invalid')
  }
  const parsed: T[] = []
  for (const item of value) {
    const next = parseItem(item)
    if (!next) {
      throw new EcashBackupValidationError('invalid')
    }
    parsed.push(next)
  }
  return parsed
}

export function parseEcashBackupPayload(input: unknown): ParsedEcashBackup {
  if (!isRecord(input)) {
    throw new EcashBackupValidationError('invalid')
  }
  if (!('proofs' in input)) {
    throw new EcashBackupValidationError('proofs_missing')
  }
  const proofs = parseObjectArray(input.proofs, parseRestoredProof)
  const mints =
    input.mints === undefined
      ? []
      : parseObjectArray(input.mints, parseRestoredMint)
  const transactions =
    input.transactions === undefined
      ? []
      : parseObjectArray(input.transactions, parseRestoredTransaction)

  return {
    mints,
    proofs: normalizeRestoredProofs(proofs, mints),
    transactions
  }
}

export function mergeByKey<T>(
  existing: T[],
  incoming: T[],
  keyOf: (item: T) => string
): T[] {
  const merged = new Map(existing.map((item) => [keyOf(item), item]))
  for (const item of incoming) {
    const key = keyOf(item)
    if (!merged.has(key)) {
      merged.set(key, item)
    }
  }
  return [...merged.values()]
}
