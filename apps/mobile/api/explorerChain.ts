import * as bitcoinjs from 'bitcoinjs-lib'

import ElectrumClient, { closeElectrumClientQuietly } from '@/api/electrum'
import Esplora from '@/api/esplora'
import BitcoinRpc from '@/api/rpc'
import type {
  Backend,
  Network,
  RpcCredentials
} from '@/types/settings/blockchain'
import { getDifficultyFromBits } from '@/utils/bitcoin/difficulty'

export type ChainSource = 'backend' | 'mempool'

export type ChainData = {
  height: number | null
  hash: string | null
  timestamp: number | null
  difficulty: number | null
  source: ChainSource
}

function emptyChainData(source: ChainSource = 'backend'): ChainData {
  return {
    difficulty: null,
    hash: null,
    height: null,
    source,
    timestamp: null
  }
}

async function fromEsplora(esplora: Esplora): Promise<ChainData> {
  const data = emptyChainData('backend')
  try {
    const [rawHeight, rawHash] = await Promise.all([
      esplora.getLatestBlockHeight(),
      esplora.getLatestBlockHash()
    ])
    data.height = Number(rawHeight)
    data.hash = String(rawHash)

    const block = await esplora.getBlockInfo(data.hash)
    data.timestamp = block.timestamp
    data.difficulty = block.difficulty
  } catch {
    /* silently ignored */
  }
  return data
}

async function fromElectrum(url: string, network: Network): Promise<ChainData> {
  const data = emptyChainData('backend')
  let client: ElectrumClient | null = null
  try {
    client = ElectrumClient.fromUrl(url, network)
    await client.init()

    const tip = await client.subscribeToBlockHeaders()
    if (!tip?.height) {
      return data
    }
    data.height = tip.height

    const header: bitcoinjs.Block = await client.getBlock(tip.height)
    data.hash = header.getId()
    data.timestamp = header.timestamp
    if (header.bits) {
      data.difficulty = getDifficultyFromBits(header.bits)
    }
  } catch {
    /* silently ignored */
  } finally {
    closeElectrumClientQuietly(client)
  }
  return data
}

async function fromRpc(
  url: string,
  username: string,
  password: string
): Promise<ChainData> {
  const data = emptyChainData('backend')
  try {
    const rpc = new BitcoinRpc(url, username, password)
    const info = await rpc.getBlockchainInfo()
    data.height = info.blocks
    data.hash = info.bestblockhash
    data.difficulty = info.difficulty
    data.source = 'backend'

    const block = await rpc.getBlock(info.bestblockhash)
    data.timestamp = block.time
  } catch {
    /* silently ignored */
  }
  return data
}

type ServerConfig = {
  backend: Backend
  rpcCredentials?: RpcCredentials
  url: string
}

export function fetchChainData(
  server: ServerConfig,
  network: Network
): Promise<ChainData> {
  if (server.backend === 'esplora' && server.url) {
    return fromEsplora(new Esplora(server.url))
  }
  if (server.backend === 'electrum' && server.url) {
    return fromElectrum(server.url, network)
  }
  if (server.backend === 'rpc' && server.url) {
    return fromRpc(
      server.url,
      server.rpcCredentials?.username ?? '',
      server.rpcCredentials?.password ?? ''
    )
  }
  return Promise.resolve(emptyChainData('backend'))
}
