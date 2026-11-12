import ElectrumClient from '@/api/electrum'
import { assertElectrumReachable } from '@/api/electrumReachability'
import Esplora from '@/api/esplora'
import BitcoinRpc from '@/api/rpc'
import { type Server } from '@/types/settings/blockchain'
import { type ServerChainReader } from '@/utils/walletChain'

type OpenServerChainReader = ServerChainReader & { close: () => void }

function esploraChainReader(url: string): OpenServerChainReader {
  const esplora = new Esplora(url)
  return {
    blockHash: (height) => esplora.getBlockAtHeight(height),
    close: () => undefined,
    tipHeight: () => esplora.getLatestBlockHeight()
  }
}

function rpcChainReader(server: Server): OpenServerChainReader {
  const rpc = new BitcoinRpc(
    server.url,
    server.rpcCredentials?.username ?? '',
    server.rpcCredentials?.password ?? ''
  )
  return {
    blockHash: (height) => rpc.getBlockHash(height),
    close: () => undefined,
    tipHeight: () => rpc.getBlockCount()
  }
}

async function electrumChainReader(
  server: Server
): Promise<OpenServerChainReader> {
  // The same cached ping the sync's own connect uses: a dead server fails
  // once, fast, instead of waiting out the chain check's timeout first.
  await assertElectrumReachable(server.url)
  const electrum = await ElectrumClient.initClientFromUrl(
    server.url,
    server.network
  )
  return {
    blockHash: async (height) => {
      const header = await electrum.getBlock(height)
      return header.getId()
    },
    close: () => electrum.close(),
    tipHeight: async () => {
      const tip = await electrum.subscribeToBlockHeaders()
      return tip.height
    }
  }
}

/** Reads block hashes from the server; the caller closes it. */
function openServerChainReader(server: Server): Promise<OpenServerChainReader> {
  if (server.backend === 'esplora') {
    return Promise.resolve(esploraChainReader(server.url))
  }
  if (server.backend === 'rpc') {
    return Promise.resolve(rpcChainReader(server))
  }
  return electrumChainReader(server)
}

export { openServerChainReader }
