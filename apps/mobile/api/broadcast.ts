import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import BitcoinRpc from '@/api/rpc'
import type { Network, Server } from '@/types/settings/blockchain'

type BroadcastServer = Pick<Server, 'backend' | 'rpcCredentials' | 'url'>

export async function broadcastRawTransaction(
  txHex: string,
  server: BroadcastServer,
  network?: Network
): Promise<string> {
  if (server.backend === 'electrum') {
    const client = await ElectrumClient.initClientFromUrl(server.url, network)
    try {
      return await client.broadcastTransactionHex(txHex)
    } finally {
      client.close()
    }
  }
  if (server.backend === 'rpc') {
    const rpc = new BitcoinRpc(
      server.url,
      server.rpcCredentials?.username ?? '',
      server.rpcCredentials?.password ?? ''
    )
    return rpc.sendRawTransaction(txHex)
  }
  if (server.backend === 'esplora') {
    return new Esplora(server.url).broadcastTransaction(txHex)
  }
  // Persisted settings are not validated on load, so an unknown backend can
  // reach here at runtime. It must not be sent to the URL as Esplora.
  const unsupportedBackend: never = server.backend
  throw new Error(`Unsupported backend: ${String(unsupportedBackend)}`)
}
