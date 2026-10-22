import type { EcashKeysetCounter } from '@/types/models/Ecash'

/** Keyset counters in the shape cashu-ts expects for deterministic secrets. */
function buildCounterInit(counters: EcashKeysetCounter[]) {
  const init: Record<string, number> = {}
  for (const c of counters) {
    init[c.keysetId] = c.counter
  }
  return init
}

/**
 * Counters with `keysetId` advanced to `nextCounter`. A counter never moves
 * back, so deterministic secrets are not derived twice.
 */
function withAdvancedKeysetCounter(
  counters: EcashKeysetCounter[],
  keysetId: string,
  nextCounter: number
) {
  const currentCounter =
    counters.find((c) => c.keysetId === keysetId)?.counter ?? 0
  return [
    ...counters.filter((c) => c.keysetId !== keysetId),
    { counter: Math.max(currentCounter, nextCounter), keysetId }
  ]
}

export { buildCounterInit, withAdvancedKeysetCounter }
