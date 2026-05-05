const noNavScreens = new Set(['settings'])

export function showNavigation(path = '/', depth = 0): boolean {
  if (depth > 4) {
    return false
  }

  const [screen] = path.replace(/^\/+/, '').split('/')
  if (noNavScreens.has(screen)) {
    return false
  }

  return true
}

// Directory segments that have no index.tsx route of their own — they only
// contain dynamic-parameter children (e.g. transaction/[txid]). When one of
// these is the last segment of a computed parent path, strip it too so we
// land on the nearest ancestor that is a real screen.
const CONTAINER_SEGMENTS = new Set([
  'transaction',
  'address',
  'utxo',
  'channel',
  'proof',
  'zap',
  'contact',
  'device'
])

// Maps computed parent paths that have no corresponding file-system route to
// their real logical parent. Only add entries for paths that do NOT have a
// route file (index.tsx). Valid routes like /signer/lightning, /settings,
// /signer/nostr/create etc. must NOT appear here — stripping the last segment
// already produces the correct parent for those.
const PARENT_PATH_OVERRIDES: Record<string, string> = {
  '/converter': '/',
  '/explorer': '/',
  '/signer': '/',
  '/signer/ark/account': '/signer/ark',
  '/signer/bitcoin': '/',
  '/signer/bitcoin/account': '/signer/bitcoin/accountList',
  '/signer/ecash/account': '/signer/ecash',
  '/signer/nostr/account': '/signer/nostr'
}

export function getBackPath(pathname: string): string {
  const segments = pathname.replace(/^\/+/, '').split('/').filter(Boolean)
  if (segments.length === 0) {
    return '/'
  }

  let parentSegments = segments.slice(0, -1)

  const lastParentSeg = parentSegments.at(-1)
  if (lastParentSeg && CONTAINER_SEGMENTS.has(lastParentSeg)) {
    parentSegments = parentSegments.slice(0, -1)
  }

  const computedParent =
    parentSegments.length === 0 ? '/' : '/' + parentSegments.join('/')
  return PARENT_PATH_OVERRIDES[computedParent] ?? computedParent
}
