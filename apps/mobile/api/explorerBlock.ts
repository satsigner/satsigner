import { type MempoolOracle } from '@/api/blockchain'
import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import BitcoinRpc from '@/api/rpc'
import type { Block as BaseBlock } from '@/types/models/Blockchain'
import type { Backend, RpcCredentials } from '@/types/settings/blockchain'
import type { PartialSome } from '@/types/utils'
import { getDifficultyFromBits } from '@/utils/bitcoin/difficulty'

export type ExplorerBlock = PartialSome<
  BaseBlock,
  'merkle_root' | 'mediantime' | 'tx_count' | 'previousblockhash'
>

async function fetchBlockEsplora(
  url: string,
  height: number
): Promise<ExplorerBlock> {
  const esplora = new Esplora(url)
  const blockHash = await esplora.getBlockAtHeight(height)
  return esplora.getBlockInfo(blockHash)
}

async function fetchBlockElectrum(
  url: string,
  height: number
): Promise<ExplorerBlock> {
  const electrum = await ElectrumClient.initClientFromUrl(url)
  try {
    const block = await electrum.getBlock(height)
    return {
      difficulty: getDifficultyFromBits(block.bits),
      height,
      id: block.getId(),
      mediantime: undefined,
      merkle_root: block.merkleRoot?.toString('hex'),
      nonce: block.nonce,
      previousblockhash: block.prevHash?.toString('hex'),
      size: block.weight() * 4,
      timestamp: block.timestamp,
      tx_count: block.transactions?.length,
      version: block.version,
      weight: block.weight()
    }
  } finally {
    electrum.close()
  }
}

async function fetchBlockRpc(
  url: string,
  height: number,
  rpcCredentials?: RpcCredentials
): Promise<ExplorerBlock> {
  const rpc = new BitcoinRpc(
    url,
    rpcCredentials?.username ?? '',
    rpcCredentials?.password ?? ''
  )
  const hash = await rpc.getBlockHash(height)
  const rpcBlock = await rpc.getBlock(hash)
  return {
    difficulty: rpcBlock.difficulty,
    height: rpcBlock.height,
    id: rpcBlock.hash,
    mediantime: rpcBlock.mediantime,
    merkle_root: rpcBlock.merkleroot,
    nonce: rpcBlock.nonce,
    previousblockhash: rpcBlock.previousblockhash,
    size: rpcBlock.size,
    timestamp: rpcBlock.time,
    tx_count: rpcBlock.tx.length,
    version: rpcBlock.version,
    weight: rpcBlock.weight
  }
}

export function fetchExplorerBlock(
  url: string,
  backend: Backend,
  height: number,
  rpcCredentials?: RpcCredentials
): Promise<ExplorerBlock> {
  if (backend === 'esplora') {
    return fetchBlockEsplora(url, height)
  }
  if (backend === 'rpc') {
    return fetchBlockRpc(url, height, rpcCredentials)
  }
  return fetchBlockElectrum(url, height)
}

export function fetchExplorerBlockFromMempool(
  height: number,
  oracle: MempoolOracle
): Promise<ExplorerBlock> {
  return oracle.getBlockAtHeight(height)
}

export async function fetchExplorerTipHeight(
  url: string,
  backend: Backend,
  rpcCredentials?: RpcCredentials
): Promise<number> {
  if (backend === 'esplora') {
    const esplora = new Esplora(url)
    return esplora.getLatestBlockHeight()
  }
  if (backend === 'rpc') {
    const rpc = new BitcoinRpc(
      url,
      rpcCredentials?.username ?? '',
      rpcCredentials?.password ?? ''
    )
    return rpc.getBlockCount()
  }
  const electrum = await ElectrumClient.initClientFromUrl(url)
  try {
    const header = await electrum.subscribeToBlockHeaders()
    return header?.height ?? 0
  } finally {
    electrum.close()
  }
}
