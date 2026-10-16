import type { EcashKeysetCounter } from '@/types/models/Ecash'

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

export { buildCounterInit, withKeysetCounter }
