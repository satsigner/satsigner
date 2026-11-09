const ONION_HOST_REGEX =
  /^(?:[a-z]+:\/\/)?(?:[^@/]+@)?[a-z2-7]{16,56}\.onion(?::\d+)?(?:\/|$)/i

export function isOnionUrl(url: string): boolean {
  return ONION_HOST_REGEX.test(url.trim())
}
