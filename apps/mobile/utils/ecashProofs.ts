import type { EcashProof } from '@/types/models/Ecash'

export function replaceMintProofs(
  allProofs: EcashProof[],
  mintUrl: string,
  nextMintProofs: EcashProof[]
): EcashProof[] {
  return [
    ...allProofs.filter((proof) => proof.mintUrl !== mintUrl),
    ...nextMintProofs
  ]
}

export function proofsAfterSend(
  allProofs: EcashProof[],
  mintUrl: string,
  keep: EcashProof[]
): EcashProof[] {
  return replaceMintProofs(allProofs, mintUrl, keep)
}

export function proofsAfterMelt(
  allProofs: EcashProof[],
  mintUrl: string,
  keep: EcashProof[],
  change: EcashProof[]
): EcashProof[] {
  return replaceMintProofs(allProofs, mintUrl, [...keep, ...change])
}

export function removeSpentSecrets(
  allProofs: EcashProof[],
  spentSecrets: string[]
): EcashProof[] {
  const spent = new Set(spentSecrets)
  return allProofs.filter((proof) => !spent.has(proof.secret))
}
