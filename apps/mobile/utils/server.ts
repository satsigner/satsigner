import { type Server } from '@/types/settings/blockchain'

type ServerEndpoint = Pick<Server, 'backend' | 'url'>

export function isSameServerEndpoint(a: ServerEndpoint, b: ServerEndpoint) {
  return a.backend === b.backend && a.url === b.url
}

/** Same endpoint saved under the same name: one row in the server list. */
export function isSameServer(
  a: ServerEndpoint & Pick<Server, 'name'>,
  b: ServerEndpoint & Pick<Server, 'name'>
) {
  return isSameServerEndpoint(a, b) && a.name === b.name
}
