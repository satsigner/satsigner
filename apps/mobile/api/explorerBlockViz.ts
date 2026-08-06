import { z } from 'zod'

import { type MempoolOracle } from '@/api/blockchain'
import type { ExplorerBlockVizData } from '@/types/explorer/blockViz'

const PoolSchema = z
  .object({
    id: z.number().nullable().optional(),
    name: z.string().nullable().optional(),
    slug: z.string().nullable().optional()
  })
  .passthrough()

const BlockExtrasSchema = z
  .object({
    avgFee: z.number().nullable().optional(),
    avgFeeRate: z.number().nullable().optional(),
    avgTxSize: z.number().nullable().optional(),
    feeRange: z.array(z.number()).optional(),
    matchRate: z.number().nullable().optional(),
    medianFee: z.number().nullable().optional(),
    pool: PoolSchema.nullable().optional(),
    reward: z.number().nullable().optional(),
    segwitTotalTxs: z.number().nullable().optional(),
    totalFees: z.number().nullable().optional(),
    totalInputs: z.number().nullable().optional(),
    totalOutputs: z.number().nullable().optional(),
    virtualSize: z.number().nullable().optional()
  })
  .passthrough()

const BlockWithExtrasSchema = z
  .object({
    extras: BlockExtrasSchema.optional(),
    height: z.number(),
    id: z.string(),
    tx_count: z.number().optional()
  })
  .passthrough()

const BlocksWithExtrasSchema = z.array(BlockWithExtrasSchema)

const SampleTxSchema = z.object({
  fee: z.number(),
  txid: z.string(),
  weight: z.number()
})

function feeRateFromTx(fee: number, weight: number): number {
  const vsize = Math.max(weight / 4, 1)
  return fee / vsize
}

export async function fetchExplorerBlockVizFromMempool(
  height: number,
  oracle: Pick<MempoolOracle, 'get' | 'getBlockTransactions'>
): Promise<ExplorerBlockVizData> {
  const blocksRaw = await oracle.get(`/v1/blocks/${height}`)
  const blocks = BlocksWithExtrasSchema.parse(blocksRaw)
  const match = blocks.find((block) => block.height === height) ?? blocks[0]
  if (!match) {
    throw new Error('block_viz_not_found')
  }

  const sampleTxsRaw = await oracle
    .getBlockTransactions(match.id)
    .catch(() => [])

  const sampleTxs = z
    .array(SampleTxSchema)
    .parse(sampleTxsRaw)
    .map((tx) => ({
      feeRate: feeRateFromTx(tx.fee, tx.weight),
      txid: tx.txid,
      weight: tx.weight
    }))

  const extras = match.extras ?? {}

  return {
    extras: {
      avgFee: extras.avgFee ?? null,
      avgFeeRate: extras.avgFeeRate ?? null,
      avgTxSize: extras.avgTxSize ?? null,
      feeRange: extras.feeRange ?? [],
      matchRate: extras.matchRate ?? null,
      medianFee: extras.medianFee ?? null,
      pool: extras.pool
        ? {
            id: extras.pool.id ?? null,
            name: extras.pool.name ?? null,
            slug: extras.pool.slug ?? null
          }
        : null,
      reward: extras.reward ?? null,
      segwitTotalTxs: extras.segwitTotalTxs ?? null,
      totalFees: extras.totalFees ?? null,
      totalInputs: extras.totalInputs ?? null,
      totalOutputs: extras.totalOutputs ?? null,
      virtualSize: extras.virtualSize ?? null
    },
    height: match.height,
    id: match.id,
    sampleTxs,
    source: 'mempool',
    txCount: match.tx_count ?? sampleTxs.length
  }
}
