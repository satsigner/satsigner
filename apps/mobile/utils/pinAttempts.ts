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

export { type PinAttempts, toPinAttempts }
