import { type Account, type Key } from '@/types/models/Account'
import { getKeyFingerprint } from '@/utils/account'
import {
  buildPubkeyToCosignerIndex,
  combineSignedPsbtsPerCosigner,
  extractIndividualSignedPsbts,
  matchSignedPsbtsToCosigners,
  readPartiallySignedPsbt
} from '@/utils/psbt'

type FindSignedPsbtsPerCosignerInPsbtParams = {
  account: Account
  decryptedKeys: Key[]
  partiallySignedPsbtBase64: string
  existingSignedPsbts: Map<number, string>
}

async function findSignedPsbtsPerCosignerInPsbt({
  account,
  decryptedKeys,
  partiallySignedPsbtBase64,
  existingSignedPsbts
}: FindSignedPsbtsPerCosignerInPsbtParams) {
  const partiallySigned = readPartiallySignedPsbt(partiallySignedPsbtBase64)
  if (!partiallySigned) {
    return new Map<number, string>()
  }

  const keyFingerprints = await Promise.all(
    account.keys.map((key) => getKeyFingerprint(key))
  )
  const pubkeyToCosignerIndex = buildPubkeyToCosignerIndex(
    partiallySigned.psbt,
    keyFingerprints
  )
  const signedPsbtsBySigner = extractIndividualSignedPsbts(
    partiallySignedPsbtBase64,
    partiallySigned.originalPsbtBase64
  )

  const matches = matchSignedPsbtsToCosigners(
    signedPsbtsBySigner,
    pubkeyToCosignerIndex,
    account,
    decryptedKeys,
    existingSignedPsbts
  )
  return combineSignedPsbtsPerCosigner(matches)
}

export { findSignedPsbtsPerCosignerInPsbt }
