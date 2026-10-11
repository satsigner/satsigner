import z from 'zod'

import { BlockchainInfoSchema, BlockTemplateSchema } from '@/types/models/Rpc'

const RpcErrorSchema = z.object({
  code: z.number(),
  message: z.string()
})

/**
 * `getblockchaininfo` fields the energy screen reads. Any other field the node
 * returns is kept as-is.
 */
const EnergyBlockchainInfoSchema = BlockchainInfoSchema.pick({
  bestblockhash: true,
  blocks: true,
  chain: true,
  difficulty: true,
  headers: true,
  verificationprogress: true
}).loose()

/**
 * `getblocktemplate` fields the energy screen mines with and displays. Any
 * other field the node returns is kept as-is, so the full template can still
 * be shown.
 */
const EnergyBlockTemplateSchema = BlockTemplateSchema.pick({
  bits: true,
  coinbasevalue: true,
  curtime: true,
  height: true,
  mintime: true,
  previousblockhash: true,
  sizelimit: true,
  transactions: true,
  version: true
}).loose()

/**
 * Wraps a result schema in the Bitcoin Core JSON-RPC envelope, where `result`
 * and `error` may each be null.
 */
function rpcResponseSchema<T extends z.ZodType>(result: T) {
  return z.object({
    error: RpcErrorSchema.nullish(),
    result: result.nullish()
  })
}

type EnergyBlockchainInfo = z.infer<typeof EnergyBlockchainInfoSchema>
type EnergyBlockTemplate = z.infer<typeof EnergyBlockTemplateSchema>

const ChainInfoResponseSchema = rpcResponseSchema(
  BlockchainInfoSchema.pick({ chain: true })
)
const BlockchainInfoResponseSchema = rpcResponseSchema(
  EnergyBlockchainInfoSchema
)
const BlockTemplateResponseSchema = rpcResponseSchema(EnergyBlockTemplateSchema)

/**
 * Validates a `getblockchaininfo` JSON-RPC body when only the chain name is
 * needed. Throws when the body does not match.
 */
function parseChainInfoResponse(body: unknown) {
  return ChainInfoResponseSchema.parse(body)
}

/**
 * Validates a `getblockchaininfo` JSON-RPC body. Throws when the body does not
 * match.
 */
function parseBlockchainInfoResponse(body: unknown) {
  return BlockchainInfoResponseSchema.parse(body)
}

/**
 * Validates a `getblocktemplate` JSON-RPC body. Throws when the body does not
 * match.
 */
function parseBlockTemplateResponse(body: unknown) {
  return BlockTemplateResponseSchema.parse(body)
}

export {
  type EnergyBlockchainInfo,
  type EnergyBlockTemplate,
  parseBlockchainInfoResponse,
  parseBlockTemplateResponse,
  parseChainInfoResponse
}
