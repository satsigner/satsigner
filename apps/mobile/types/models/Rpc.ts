import z from 'zod'

export type Hex = string

export const BlockTemplateTransactionSchema = z.object({
  data: z.string(), // transaction data encoded in hexadecimal
  depends: z.array(z.number()), // 1-based indices of transactions this one depends on
  fee: z.number().optional(), // difference between inputs and outputs (in satoshis); optional
  hash: z.string(), // transaction hash (including witness data, little-endian hexadecimal)
  required: z.boolean().optional(), // if true, this transaction must be in the final block
  sigops: z.number().optional(), // total sigops cost; optional
  txid: z.string(), // transaction id (little-endian hexadecimal)
  weight: z.number().optional() // total transaction weight; optional
})

export const BlockTemplateSchema = z.object({
  bits: z.string(), // compressed target of the next block
  coinbaseaux: z
    .object({
      flags: z.string().optional(), // data to include in coinbase's scriptsig
      key: z.string() // ?
    })
    .optional(),
  coinbasevalue: z.number(), // maximum allowable input to coinbase transaction (in satoshis)
  curtime: z.number(), // current timestamp (unix epoch time)
  default_witness_commitment: z.string().optional(), // hex-encoded witness commitment for unmodified template
  height: z.number(), // height of the next block
  longpollid: z.string().optional(), // id for longpoll request
  mintime: z.number(), // minimum timestamp for the next block (unix epoch time)
  mutable: z.array(z.string()), // ways the block template may be changed (e.g., ["time", "transactions", "prevblock"])
  noncerange: z.string(), // range of valid nonces (hex)
  previousblockhash: z.string(), // hash of the current highest block
  rules: z.array(z.string()), // specific block rules to be enforced (e.g., ["segwit"])
  signet_challenge: z.string().optional(), // hex-encoded signet challenge (signet network only)
  sigoplimit: z.number(), // limit of sigops in blocks
  sizelimit: z.number(), // limit of block size
  target: z.string(), // the hash target
  transactions: z.array(BlockTemplateTransactionSchema), // non-coinbase transactions to include
  vbavailable: z.record(z.string(), z.number()), // pending versionbit (bip 9) softfork deployments
  vbrequired: z.number(), // bit mask of versionbits required by the server
  version: z.number(), // the preferred block version
  weightlimit: z.number().optional() // limit of block weight; optional
})

export const BlockchainInfoSchema = z.object({
  automatic_pruning: z.boolean().optional(), // whether automatic pruning is enabled (optional)
  bestblockhash: z.string(), // hash of the best (tip) block
  blocks: z.number(), // current number of blocks
  chain: z.string(), // current network name (e.g., "main", "test", "regtest", "signet")
  chainwork: z.string(), // total work in the chain (hex-encoded)
  difficulty: z.number(), // current difficulty
  headers: z.number(), // current number of block headers
  initialblockdownload: z.boolean(), // whether the node is in initial block download (ibd)
  mediantime: z.number(), // median time of the last 11 blocks (unix epoch time)
  prune_target_size: z.number().optional(), // target size for pruning in bytes if automatic pruning is enabled (optional)
  pruned: z.boolean(), // whether the node is running in pruned mode
  pruneheight: z.number().optional(), // lowest-height complete block stored if pruned (optional)
  size_on_disk: z.number(), // estimated size of the blockchain on disk (bytes)
  softforks: z.record(
    z.string(),
    z.object({
      active: z.boolean(), // whether the softfork is active
      bip9: z
        .object({
          bit: z.number().optional(), // bit used for signaling (0-28)
          since: z.number(), // height where signaling began
          start_time: z.number(), // start time (unix epoch)
          statistics: z
            .object({
              count: z.number(), // blocks signaling for softfork
              elapsed: z.number(), // blocks elapsed in current period
              period: z.number(), // current signaling period
              possible: z.boolean(), // whether activation is still possible
              threshold: z.number() // number of blocks needed for activation
            })
            .optional(),
          status: z.string(), // status of softfork (e.g., "defined", "started", "locked_in", "active", "failed")
          timeout: z.number() // timeout time (unix epoch)
        })
        .optional(),
      height: z.number().optional(), // height of activation for non-bip 9 softforks (optional)
      type: z.string() // type of softfork (e.g., "bip9")
    })
  ),
  time: z.number(), // median time of the current tip block (unix epoch time)
  verificationprogress: z.number(), // estimate of verification progress [0..1]
  warnings: z.string().optional() // warning messages, if any (optional)
})

export type BlockchainInfo = z.infer<typeof BlockchainInfoSchema>
export type BlockTemplate = z.infer<typeof BlockTemplateSchema>
export type BlockTemplateTransaction = z.infer<
  typeof BlockTemplateTransactionSchema
>
