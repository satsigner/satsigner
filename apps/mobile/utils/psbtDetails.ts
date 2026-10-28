import { NOSTR_PSBT_DETAILS_CACHE_MAX } from '@/constants/nostr'
import {
  extractIndividualSignedPsbts,
  extractOriginalPsbt,
  extractTransactionIdFromPSBT,
  getMultisigInfoFromPsbt
} from '@/utils/psbt'

type PsbtDetails = {
  collectedSignatures: number[]
  keyCount: number
  keysRequired: number
  originalPsbt: string
  txid: string
}

const psbtDetailsCache = new Map<string, PsbtDetails | null>()

function decodePsbtDetails(combinedPsbt: string): PsbtDetails | null {
  try {
    const txid = extractTransactionIdFromPSBT(combinedPsbt)
    if (!txid) {
      return null
    }
    const originalPsbt = extractOriginalPsbt(combinedPsbt)
    const multisigInfo = getMultisigInfoFromPsbt(combinedPsbt)
    const signedPsbts = extractIndividualSignedPsbts(combinedPsbt, originalPsbt)
    return {
      collectedSignatures: Object.keys(signedPsbts).map(Number),
      keyCount: multisigInfo?.total ?? 0,
      keysRequired: multisigInfo?.required ?? 0,
      originalPsbt,
      txid
    }
  } catch {
    return null
  }
}

/**
 * Decodes the account-independent parts of a shared PSBT. Results are cached
 * by PSBT string (bounded, oldest evicted first) so chat rows re-rendering
 * do not parse the same PSBT again. Returns null for an invalid PSBT.
 */
function parsePsbtDetails(combinedPsbt: string): PsbtDetails | null {
  if (psbtDetailsCache.has(combinedPsbt)) {
    return psbtDetailsCache.get(combinedPsbt) ?? null
  }
  const details = decodePsbtDetails(combinedPsbt)
  psbtDetailsCache.set(combinedPsbt, details)
  if (psbtDetailsCache.size > NOSTR_PSBT_DETAILS_CACHE_MAX) {
    const [oldest] = psbtDetailsCache.keys()
    psbtDetailsCache.delete(oldest)
  }
  return details
}

function clearPsbtDetailsCache(): void {
  psbtDetailsCache.clear()
}

export { clearPsbtDetailsCache, parsePsbtDetails }
export type { PsbtDetails }
