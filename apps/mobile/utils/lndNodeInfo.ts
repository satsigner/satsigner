import {
  type LNDGetInfoChain,
  type LNDNodeInfo
} from '@/types/models/Lightning'
import { isRecord } from '@/utils/object'

function parseLndChains(value: unknown): LNDGetInfoChain[] {
  if (!Array.isArray(value)) {
    return []
  }
  const chains: LNDGetInfoChain[] = []
  for (const item of value) {
    if (!isRecord(item)) {
      continue
    }
    if (typeof item.chain !== 'string' || typeof item.network !== 'string') {
      continue
    }
    chains.push({ chain: item.chain, network: item.network })
  }
  return chains
}

export function parseLndNodeInfo(value: unknown): LNDNodeInfo | null {
  if (!isRecord(value)) {
    return null
  }
  if (
    typeof value.identity_pubkey !== 'string' ||
    value.identity_pubkey.length === 0
  ) {
    return null
  }

  return {
    alias: typeof value.alias === 'string' ? value.alias : '',
    best_header_timestamp:
      typeof value.best_header_timestamp === 'string'
        ? value.best_header_timestamp
        : '',
    block_hash: typeof value.block_hash === 'string' ? value.block_hash : '',
    block_height:
      typeof value.block_height === 'number' ? value.block_height : 0,
    chains: parseLndChains(value.chains),
    commit_hash: typeof value.commit_hash === 'string' ? value.commit_hash : '',
    identity_pubkey: value.identity_pubkey,
    num_active_channels:
      typeof value.num_active_channels === 'number'
        ? value.num_active_channels
        : 0,
    num_peers: typeof value.num_peers === 'number' ? value.num_peers : 0,
    synced_to_chain: value.synced_to_chain === true,
    uris: Array.isArray(value.uris)
      ? value.uris.filter((uri) => typeof uri === 'string')
      : [],
    version: typeof value.version === 'string' ? value.version : ''
  }
}
