const sessionPin: { digest: string | null } = { digest: null }

/** In-memory AES key for this unlocked session. Not persisted. */
function getSessionPinDigest(): string | null {
  return sessionPin.digest
}

function setSessionPinDigest(digest: string | null): void {
  sessionPin.digest = digest
}

export { getSessionPinDigest, setSessionPinDigest }
