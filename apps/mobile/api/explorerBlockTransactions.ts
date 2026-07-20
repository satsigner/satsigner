import { MempoolOracle } from '@/api/blockchain'
import Esplora from '@/api/esplora'
import BitcoinRpc from '@/api/rpc'
import type { Backend, RpcCredentials } from '@/types/settings/blockchain'

export type BlockTxidsResult = {
  height: number | null
  txids: string[]
  sizes: number[]
  source: 'backend' | 'mempool'
}

export async function fetchBlockTxidsFromBackend(
  blockHash: string,
  url: string,
  backend: Backend,
  rpcCredentials?: RpcCredentials
): Promise<BlockTxidsResult> {
  if (backend === 'esplora') {
    const esplora = new Esplora(url)
    const [block, txids, sampleTxs] = await Promise.all([
      esplora.getBlockInfo(blockHash),
      esplora.getBlockTransactionIds(blockHash),
      esplora.getBlockTransactions(blockHash, 0).catch(() => [])
    ])
    return {
      height: block.height,
      sizes: sampleTxs.map((tx) => tx.weight),
      source: 'backend',
      txids
    }
  }

  if (backend === 'rpc') {
    const rpc = new BitcoinRpc(
      url,
      rpcCredentials?.username ?? '',
      rpcCredentials?.password ?? ''
    )
    const block = await rpc.getBlock(blockHash)
    return {
      height: block.height,
      sizes: [],
      source: 'backend',
      txids: block.tx
    }
  }

  throw new Error('electrum_unsupported')
}

export async function fetchBlockTxidsFromMempool(
  blockHash: string,
  oracle: MempoolOracle
): Promise<BlockTxidsResult> {
  const [block, txids, sampleTxs] = await Promise.all([
    oracle.getBlock(blockHash),
    oracle.getBlockTransactionIds(blockHash),
    oracle.getBlockTransactions(blockHash).catch(() => [])
  ])
  return {
    height: block.height,
    sizes: sampleTxs.map((tx) => tx.weight),
    source: 'mempool',
    txids
  }
}
