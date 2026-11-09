import { servers } from '@/constants/servers'
import { type Server } from '@/types/settings/blockchain'

/**
 * Who can see the wallet's addresses through this server, following Sparrow:
 * `node` is the user's own Bitcoin Core, `private` a server they confirmed
 * they run or trust, `public` anything else.
 */
export type ServerPrivacy = 'node' | 'private' | 'public'

const ONION_HOST_REGEX =
  /^(?:[a-z]+:\/\/)?(?:[^@/]+@)?(?:[a-z0-9-]+\.)*[a-z2-7]{16,56}\.onion(?::\d+)?(?:\/|$)/i

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

export function isSameServer(a: Server, b: Server): boolean {
  return a.url === b.url && a.name === b.name && a.backend === b.backend
}
