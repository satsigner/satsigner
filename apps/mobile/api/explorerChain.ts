import * as bitcoinjs from 'bitcoinjs-lib'

import { MempoolOracle } from '@/api/blockchain'
import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import BitcoinRpc from '@/api/rpc'
import type { Block } from '@/types/models/Blockchain'
import type {
  Backend,
  Network,
  RpcCredentials
} from '@/types/settings/blockchain'

export type ChainSource = 'backend' | 'mempool'

export type ChainData = {
  height: number | null
  hash: string | null
  timestamp: number | null
  difficulty: number | null
  source: ChainSource
}

function safeClose(client: ElectrumClient | null): void {
  try {
    client?.close()
  } catch {
    /* silently ignored */
  }
}

async function fromEsplora(
  esplora: Esplora,
  oracle: MempoolOracle
): Promise<Partial<ChainData>> {
  const data: Partial<ChainData> = {}
  try {
    const [rawHeight, rawHash] = await Promise.all([
      esplora.getLatestBlockHeight(),
      esplora.getLatestBlockHash()
    ])
    data.height = Number(rawHeight)
    data.hash = String(rawHash)
    data.source = 'backend'

    const block = await oracle.getBlock(data.hash)
    data.timestamp = block.timestamp
    data.difficulty = block.difficulty
  } catch {
    /* silently ignored */
  }
  return data
}

async function fromElectrum(
  url: string,
  network: Network
): Promise<Partial<ChainData>> {
  const data: Partial<ChainData> = {}
  let client: ElectrumClient | null = null
  try {
    client = ElectrumClient.fromUrl(url, network)
    await client.init()

    const tip = await client.subscribeToBlockHeaders()
    if (tip?.height) {
      data.height = tip.height
      data.source = 'backend'

      const header: bitcoinjs.Block = await client.getBlock(tip.height)
      data.hash = header.getId()
      data.timestamp = header.timestamp

      // difficulty is derived from the Mempool API fallback since bitcoinjs
      // Block headers only expose the compact `bits` target
    }
  } catch {
    /* silently ignored */
  } finally {
    safeClose(client)
  }
  return data
}

async function fromRpc(
  url: string,
  username: string,
  password: string
): Promise<Partial<ChainData>> {
  const data: Partial<ChainData> = {}
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

async function fillFromMempool(
  oracle: MempoolOracle,
  partial: Partial<ChainData>
): Promise<ChainData> {
  const data: ChainData = {
    difficulty: partial.difficulty ?? null,
    hash: partial.hash ?? null,
    height: partial.height ?? null,
    source: partial.source ?? 'mempool',
    timestamp: partial.timestamp ?? null
  }

  const needsHeight = data.height === null
  const needsHash = data.hash === null
  const needsBlockData = data.timestamp === null || data.difficulty === null

  await Promise.all([
    (async () => {
      if (!needsHeight && !needsHash) {
        return
      }
      try {
        const [mHeight, mHash] = await Promise.all([
          needsHeight ? oracle.getCurrentBlockHeight() : Promise.resolve(null),
          needsHash ? oracle.getCurrentBlockHash() : Promise.resolve(null)
        ])
        if (needsHeight && mHeight !== null) {
          data.height = mHeight
          data.source = 'mempool'
        }
        if (needsHash && mHash !== null) {
          data.hash = mHash
          data.source = 'mempool'
        }
      } catch {
        /* silently ignored */
      }
    })(),
    (async () => {
      if (!needsBlockData || !data.hash) {
        return
      }
      try {
        const block: Block = await oracle.getBlock(data.hash)
        if (data.timestamp === null) {
          data.timestamp = block.timestamp
        }
        if (data.difficulty === null) {
          data.difficulty = block.difficulty
        }
        if (needsHeight || needsHash) {
          data.source = 'mempool'
        }
      } catch {
        /* silently ignored */
      }
    })()
  ])

  if (
    needsBlockData &&
    data.hash &&
    (data.timestamp === null || data.difficulty === null)
  ) {
    try {
      const block: Block = await oracle.getBlock(data.hash)
      if (data.timestamp === null) {
        data.timestamp = block.timestamp
      }
      if (data.difficulty === null) {
        data.difficulty = block.difficulty
      }
    } catch {
      /* silently ignored */
    }
  }

  return data
}

type ServerConfig = {
  backend: Backend
  rpcCredentials?: RpcCredentials
  url: string
}

export async function fetchChainData(
  server: ServerConfig,
  network: Network,
  oracle: MempoolOracle
): Promise<ChainData> {
  if (server.backend === 'esplora' && server.url) {
    const esplora = new Esplora(server.url)
    const localOracle = new MempoolOracle(server.url)
    return fillFromMempool(oracle, await fromEsplora(esplora, localOracle))
  }
  if (server.backend === 'electrum' && server.url) {
    return fillFromMempool(oracle, await fromElectrum(server.url, network))
  }
  if (server.backend === 'rpc' && server.url) {
    return fillFromMempool(
      oracle,
      await fromRpc(
        server.url,
        server.rpcCredentials?.username ?? '',
        server.rpcCredentials?.password ?? ''
      )
    )
  }
  return fillFromMempool(oracle, {})
}
