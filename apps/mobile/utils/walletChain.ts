import { WALLET_CHAIN_CHECK_LIMIT } from '@/constants/sync'

type ChainBlock = {
  hash: string
  height: number
}

type ServerChainReader = {
  blockHash: (height: number) => Promise<string>
  tipHeight: () => Promise<number>
}

function comparableCheckpoints(
  checkpoints: readonly ChainBlock[],
  tipHeight: number
): ChainBlock[] {
  return checkpoints
    .filter((checkpoint) => checkpoint.height > 0)
    .filter((checkpoint) => checkpoint.height <= tipHeight)
    .toSorted((a, b) => b.height - a.height)
    .slice(0, WALLET_CHAIN_CHECK_LIMIT)
}

/**
 * Whether the blocks a wallet has seen are on the server's chain. Signets
 * share their genesis block, so a wallet synced on one signet (e.g.
 * Mutinynet) merges into another signet's chain without any error and keeps
 * that chain's transactions. Checks the newest blocks first: a reorg only
 * replaces the last few, so one of the older ones still matches.
 */
async function isWalletOnServerChain(
  checkpoints: readonly ChainBlock[],
  server: ServerChainReader
): Promise<boolean> {
  const hasSeenBlocks = checkpoints.some((checkpoint) => checkpoint.height > 0)
  if (!hasSeenBlocks) {
    return true
  }
  const candidates = comparableCheckpoints(
    checkpoints,
    await server.tipHeight()
  )
  for (const checkpoint of candidates) {
    // oxlint-disable-next-line no-await-in-loop -- stop at the first match
    if ((await server.blockHash(checkpoint.height)) === checkpoint.hash) {
      return true
    }
  }
  return false
}

export { isWalletOnServerChain, type ServerChainReader }
