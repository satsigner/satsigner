import { servers } from '@/constants/servers'
import { type Server } from '@/types/settings/blockchain'
import { isSameServerEndpoint } from '@/utils/server'

/**
 * Who can see the wallet's addresses through this server, following Sparrow:
 * `node` is the user's own Bitcoin Core, `private` a server they confirmed
 * they run or trust, `public` anything else.
 */
export type ServerPrivacy = 'node' | 'private' | 'public'

const ONION_HOST_REGEX =
  /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^/?#]*@)?(?:[a-z0-9_-]+\.)*[a-z2-7]{16,56}\.onion\.?(?::\d+)?(?:[/?#]|$)/i

export function isOnionUrl(url: string): boolean {
  return ONION_HOST_REGEX.test(url.trim())
}

function isPresetServerUrl(url: string): boolean {
  return servers.some((preset) => preset.url === url)
}

export function getServerPrivacy(
  server: Pick<Server, 'backend' | 'isPrivate' | 'url'>
): ServerPrivacy {
  if (server.backend === 'rpc') {
    return 'node'
  }
  if (isPresetServerUrl(server.url)) {
    return 'public'
  }
  return server.isPrivate ? 'private' : 'public'
}

/**
 * True when switching from `before` to `after` starts sending the wallet's
 * addresses to a public server the app was not already using. A rename of
 * the same endpoint exposes nothing new.
 */
function isNewlyPublic(before: Server, after: Server): boolean {
  return (
    !isSameServerEndpoint(before, after) && getServerPrivacy(after) === 'public'
  )
}

/**
 * Servers that would become active on save and are public, so the user can
 * be warned before the app connects to them. Unchanged selections are not
 * returned: the user already accepted them.
 */
export function getNewlySelectedPublicServers<K extends string>(
  current: Record<K, Server>,
  next: Record<K, Server>
): Server[] {
  return Object.keys(next)
    .filter((key): key is K => key in current)
    .filter((key) => isNewlyPublic(current[key], next[key]))
    .map((key) => next[key])
}

/**
 * The public server a backup restore switched the app to, if any. A backup
 * that keeps the server the app already used has nothing new to warn about.
 */
export function getRestoredPublicServer(
  activeBefore: Server,
  activeAfter: Server
): Server | undefined {
  return isNewlyPublic(activeBefore, activeAfter) ? activeAfter : undefined
}
