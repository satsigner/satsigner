import { getEcashMnemonic } from '@/storage/encrypted'
import type { EcashKeysetCounter } from '@/types/models/Ecash'
import { mnemonicToSeed } from '@/utils/bip39'

/** BIP39 seed for a seeded ecash account, or undefined when none is stored. */
async function getSeedForAccount(accountId: string) {
  const mnemonic = await getEcashMnemonic(accountId)
  if (!mnemonic) {
    return undefined
  }
  return mnemonicToSeed(mnemonic, '')
}

/** Keyset counters in the shape cashu-ts expects for deterministic secrets. */
function buildCounterInit(counters: EcashKeysetCounter[]) {
  const init: Record<string, number> = {}
  for (const c of counters) {
    init[c.keysetId] = c.counter
  }
  return init
}

/** Counters with `keysetId` advanced to `nextCounter`. */
function withKeysetCounter(
  counters: EcashKeysetCounter[],
  keysetId: string,
  nextCounter: number
) {
  return [
    ...counters.filter((c) => c.keysetId !== keysetId),
    { counter: nextCounter, keysetId }
  ]
}

export { buildCounterInit, getSeedForAccount, withKeysetCounter }
