type PinAttempts =
  | { status: 'counting'; left: number }
  | { status: 'exhausted' }

/**
 * Remaining PIN tries from the persisted failure counter. Once exhausted, a
 * PIN entry only retries the wipe: no PIN may be checked after the last try.
 */
function toPinAttempts(failed: number, maxTries: number): PinAttempts {
  const left = maxTries - failed
  return left > 0 ? { left, status: 'counting' } : { status: 'exhausted' }
}

/**
 * Failures counted against a limit, kept below it: reaching the limit wipes
 * the wallet before any PIN is checked, so the correct PIN would wipe too.
 */
function clampPinTries(failed: number, maxTries: number): number {
  return Math.min(failed, Math.max(0, maxTries - 1))
}

export { clampPinTries, type PinAttempts, toPinAttempts }
