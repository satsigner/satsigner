export type Hex = string

export type BlockTemplateTransaction = {
  data: Hex // Transaction data encoded in hexadecimal
  txid: Hex // Transaction ID (little-endian hexadecimal)
  hash: Hex // Transaction hash (including witness data, little-endian hexadecimal)
  depends: number[] // 1-based indices of transactions this one depends on
  fee?: number // Difference between inputs and outputs (in satoshis); optional
  sigops?: number // Total SigOps cost; optional
  weight?: number // Total transaction weight; optional
  required?: boolean // If true, this transaction must be in the final block
}

export type BlockTemplate = {
  version: number // The preferred block version
  rules: string[] // Specific block rules to be enforced (e.g., ["segwit"])
  vbavailable: Record<string, number> // Pending versionbit (BIP 9) softfork deployments
  vbrequired: number // Bit mask of versionbits required by the server
  previousblockhash: string // Hash of the current highest block
  transactions: BlockTemplateTransaction[] // Non-coinbase transactions to include
  coinbaseaux?: {
    key: Hex
    flags?: string // Data to include in coinbase's scriptSig
  } // Optional data for coinbase scriptSig
  coinbasevalue: number // Maximum allowable input to coinbase transaction (in satoshis)
  longpollid?: string // ID for longpoll request
  target: string // The hash target
  mintime: number // Minimum timestamp for the next block (UNIX epoch time)
  mutable: string[] // Ways the block template may be changed (e.g., ["time", "transactions", "prevblock"])
  noncerange: string // Range of valid nonces (hex)
  sigoplimit: number // Limit of sigops in blocks
  sizelimit: number // Limit of block size
  weightlimit?: number // Limit of block weight; optional
  curtime: number // Current timestamp (UNIX epoch time)
  bits: string // Compressed target of the next block
  height: number // Height of the next block
  signet_challenge?: string // Hex-encoded signet challenge (signet network only)
  default_witness_commitment?: string // Hex-encoded witness commitment for unmodified template
}

export type BlockchainInfo = {
  chain: string // Current network name (e.g., "main", "test", "regtest", "signet")
  blocks: number // Current number of blocks
  headers: number // Current number of block headers
  bestblockhash: string // Hash of the best (tip) block
  difficulty: number // Current difficulty
  time: number // Median time of the current tip block (UNIX epoch time)
  mediantime: number // Median time of the last 11 blocks (UNIX epoch time)
  verificationprogress: number // Estimate of verification progress [0..1]
  initialblockdownload: boolean // Whether the node is in initial block download (IBD)
  chainwork: string // Total work in the chain (hex-encoded)
  size_on_disk: number // Estimated size of the blockchain on disk (bytes)
  pruned: boolean // Whether the node is running in pruned mode
  pruneheight?: number // Lowest-height complete block stored if pruned (optional)
  automatic_pruning?: boolean // Whether automatic pruning is enabled (optional)
  prune_target_size?: number // Target size for pruning in bytes if automatic pruning is enabled (optional)
  softforks: Record<
    string,
    {
      type: string // Type of softfork (e.g., "bip9")
      bip9?: {
        status: string // Status of softfork (e.g., "defined", "started", "locked_in", "active", "failed")
        bit?: number // Bit used for signaling (0-28)
        start_time: number // Start time (UNIX epoch)
        timeout: number // Timeout time (UNIX epoch)
        since: number // Height where signaling began
        statistics?: {
          period: number // Current signaling period
          threshold: number // Number of blocks needed for activation
          elapsed: number // Blocks elapsed in current period
          count: number // Blocks signaling for softfork
          possible: boolean // Whether activation is still possible
        } // Optional statistics for active BIP 9 softforks
      } // Optional for BIP 9 softforks
      height?: number // Height of activation for non-BIP 9 softforks (optional)
      active: boolean // Whether the softfork is active
    }
  > // Status of known softforks
  warnings?: string // Warning messages, if any (optional)
}
