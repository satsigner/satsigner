import {
  WALLET_CHAIN_CHECK_LIMIT,
  WALLET_CHAIN_TIP_LAG_MARGIN
} from '@/constants/sync'

type ChainBlock = {
  hash: string
  height: number
}

type ServerChainReader = {
  blockHash: (height: number) => Promise<string>
  tipHeight: () => Promise<number>
}

const BLOCK_HASH_PATTERN = /^[0-9a-f]{64}$/

function seenBlocks(checkpoints: readonly ChainBlock[]) {
  return checkpoints.filter((checkpoint) => checkpoint.height > 0)
}

function comparableCheckpoints(
  checkpoints: readonly ChainBlock[],
  tipHeight: number
): ChainBlock[] {
  return seenBlocks(checkpoints)
    .filter((checkpoint) => checkpoint.height <= tipHeight)
    .toSorted((a, b) => b.height - a.height)
    .slice(0, WALLET_CHAIN_CHECK_LIMIT)
}

// An answer that is not a chain height or a block hash (a captive portal, a
// broken server) says nothing about the chain: the check gives up instead.
async function readTipHeight(server: ServerChainReader) {
  const tipHeight = await server.tipHeight()
  if (!Number.isSafeInteger(tipHeight) || tipHeight <= 0) {
    throw new Error('The server sent no usable chain tip')
  }
  return tipHeight
}

async function readBlockHash(server: ServerChainReader, height: number) {
  const hash = await server.blockHash(height)
  if (!BLOCK_HASH_PATTERN.test(hash)) {
    throw new Error('The server sent no usable block hash')
  }
  return hash
}

/**
 * Whether the blocks a wallet has seen are on the server's chain. Signets
 * share their genesis block, so a wallet synced on one signet (e.g.
 * Mutinynet) merges into another signet's chain without any error and keeps
 * that chain's transactions. Checks the newest blocks first: a reorg only
 * replaces the last few, so one of the older ones still matches. Rejects when
 * the server's answers can't be read.
 */
async function isWalletOnServerChain(
  checkpoints: readonly ChainBlock[],
  server: ServerChainReader
): Promise<boolean> {
  const seen = seenBlocks(checkpoints)
  if (seen.length === 0) {
    return true
  }
  const tipHeight = await readTipHeight(server)
  const candidates = comparableCheckpoints(checkpoints, tipHeight)
  if (candidates.length === 0) {
    // Every block the wallet saw is above the server's tip: a server a little
    // behind is still catching up, one far behind is on another chain.
    const lowestSeen = Math.min(...seen.map((checkpoint) => checkpoint.height))
    return lowestSeen - tipHeight <= WALLET_CHAIN_TIP_LAG_MARGIN
  }
  for (const checkpoint of candidates) {
    // oxlint-disable-next-line no-await-in-loop -- stop at the first match
    if ((await readBlockHash(server, checkpoint.height)) === checkpoint.hash) {
      return true
    }
  }
  return false
}

export { isWalletOnServerChain, type ServerChainReader }
