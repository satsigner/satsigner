import {
  connectToMint,
  getMintBalance,
  restoreProofsFromSeed
} from '@/api/ecash'
import type {
  EcashKeysetCounter,
  EcashMint,
  EcashProof
} from '@/types/models/Ecash'
import {
  buildCounterInit,
  withKeysetCounter
} from '@/utils/ecashKeysetCounters'

/** Live reads and writes on one ecash account, injected by the caller. */
type EcashAccountStore = {
  getMints: () => EcashMint[]
  getProofs: () => EcashProof[]
  getCounters: () => EcashKeysetCounter[]
  addMint: (mint: EcashMint) => void
  addProofs: (proofs: EcashProof[]) => void
  updateMintBalance: (mintUrl: string, balance: number) => void
  updateCounters: (counters: EcashKeysetCounter[]) => void
}

type RestoreSummary = {
  proofsFound: number
  totalAmount: number
  mintsScanned: number
  mintsFailed: number
}

type MintRestoreResult = { proofsFound: number; totalAmount: number }

async function restoreMint(
  accountId: string,
  mintUrl: string,
  seed: Uint8Array,
  store: EcashAccountStore
): Promise<MintRestoreResult> {
  if (!store.getMints().some((mint) => mint.url === mintUrl)) {
    store.addMint(await connectToMint(mintUrl))
  }

  const result = await restoreProofsFromSeed(
    accountId,
    mintUrl,
    seed,
    buildCounterInit(store.getCounters())
  )
  if (result.proofs.length === 0) {
    return { proofsFound: 0, totalAmount: 0 }
  }

  store.addProofs(result.proofs)
  store.updateMintBalance(mintUrl, getMintBalance(mintUrl, store.getProofs()))
  const restored = {
    proofsFound: result.proofs.length,
    totalAmount: result.proofs.reduce((sum, proof) => sum + proof.amount, 0)
  }

  const activeKeyset = store
    .getMints()
    .find((mint) => mint.url === mintUrl)
    ?.keysets.find((ks) => ks.active)
  if (result.lastCounter === undefined || !activeKeyset) {
    return restored
  }
  store.updateCounters(
    withKeysetCounter(
      store.getCounters(),
      activeKeyset.id,
      result.lastCounter + 1
    )
  )
  return restored
}

/**
 * Restores seed-derived proofs from each mint, connecting to mints the
 * account does not list yet. A mint that fails is counted and skipped.
 */
async function restoreProofsFromMints(
  accountId: string,
  mintUrls: string[],
  seed: Uint8Array,
  store: EcashAccountStore
): Promise<RestoreSummary> {
  const uniqueUrls = [
    ...new Set(mintUrls.map((url) => url.trim()).filter((url) => url.length))
  ]
  const summary: RestoreSummary = {
    mintsFailed: 0,
    mintsScanned: uniqueUrls.length,
    proofsFound: 0,
    totalAmount: 0
  }

  for (const mintUrl of uniqueUrls) {
    try {
      const restored = await restoreMint(accountId, mintUrl, seed, store)
      summary.proofsFound += restored.proofsFound
      summary.totalAmount += restored.totalAmount
    } catch {
      summary.mintsFailed += 1
    }
  }

  return summary
}

export { restoreProofsFromMints }
export type { EcashAccountStore, RestoreSummary }
