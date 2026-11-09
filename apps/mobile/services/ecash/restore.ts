import {
  connectToMint,
  getMintBalance,
  getTokenProofSecrets,
  restoreProofsFromSeed
} from '@/api/ecash'
import type { EcashAccountStore, EcashProof } from '@/types/models/Ecash'
import { buildCounterInit } from '@/utils/ecashKeysetCounters'

type RestoreSummary = {
  proofsFound: number
  totalAmount: number
  mintsScanned: number
  mintsFailed: number
  mintsIncomplete: number
}

type MintRestoreResult = {
  complete: boolean
  proofsFound: number
  totalAmount: number
}

/**
 * Proofs in a sent token stay unspent until the recipient claims them, so a
 * seed scan finds them again. They belong to the recipient now.
 */
function withoutSentProofs(proofs: EcashProof[], store: EcashAccountStore) {
  const keysetIds = store
    .getMints()
    .flatMap(({ keysets }) => keysets.map(({ id }) => id))
  const sentSecrets = new Set(
    store
      .getSentTokens()
      .flatMap((token) => getTokenProofSecrets(token, keysetIds))
  )
  return proofs.filter(({ secret }) => !sentSecrets.has(secret))
}

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
  const proofs = withoutSentProofs(result.proofs, store)
  if (proofs.length > 0) {
    store.addProofs(proofs)
    store.updateMintBalance(mintUrl, getMintBalance(mintUrl, store.getProofs()))
  }
  const restored = {
    complete: result.complete,
    proofsFound: proofs.length,
    totalAmount: proofs.reduce((sum, proof) => sum + proof.amount, 0)
  }

  const activeKeyset = store
    .getMints()
    .find((mint) => mint.url === mintUrl)
    ?.keysets.find((ks) => ks.active)
  if (result.lastCounter === undefined || !activeKeyset) {
    return restored
  }
  store.advanceKeysetCounter(activeKeyset.id, result.lastCounter + 1)
  return restored
}

/**
 * Restores seed-derived proofs from each mint, connecting to mints the
 * account does not list yet. A mint that fails is counted and skipped, and
 * one whose scan skipped a keyset is counted as incomplete.
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
    mintsIncomplete: 0,
    mintsScanned: uniqueUrls.length,
    proofsFound: 0,
    totalAmount: 0
  }

  for (const mintUrl of uniqueUrls) {
    try {
      const restored = await restoreMint(accountId, mintUrl, seed, store)
      summary.proofsFound += restored.proofsFound
      summary.totalAmount += restored.totalAmount
      summary.mintsIncomplete += restored.complete ? 0 : 1
    } catch {
      summary.mintsFailed += 1
    }
  }

  return summary
}

export { type RestoreSummary, restoreProofsFromMints }
