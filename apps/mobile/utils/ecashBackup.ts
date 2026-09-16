import { ECASH_BACKUP_VERSION } from '@/constants/ecash'
import type {
  EcashMint,
  EcashProof,
  EcashTransaction
} from '@/types/models/Ecash'

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

  return withMintUrl
}
