const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i
const TRAILING_SLASHES_RE = /\/+$/
const DEFAULT_SERVER_SCHEME = 'https://'
const SERVER_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * Base URL of a Blossom server typed by the user, with `https://` when no
 * scheme was given. Null when it is not an http(s) URL with a host.
 */
export function normalizeBlossomServerUrl(input: string): string | null {
  const trimmed = input.trim()
  const withScheme = URL_SCHEME_RE.test(trimmed)
    ? trimmed
    : `${DEFAULT_SERVER_SCHEME}${trimmed}`
  try {
    const { host, pathname, protocol } = new URL(withScheme)
    if (!SERVER_PROTOCOLS.has(protocol) || !host) {
      return null
    }
    return `${protocol}//${host}${pathname}`.replace(TRAILING_SLASHES_RE, '')
  } catch {
    return null
  }
}
