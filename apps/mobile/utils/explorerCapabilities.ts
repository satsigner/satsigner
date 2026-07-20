import type {
  ExplorerCapabilityResult,
  ExplorerFeature
} from '@/types/explorer/capabilities'
import type { Backend } from '@/types/settings/blockchain'

const CAPABILITY_KEYS: Record<
  ExplorerFeature,
  Record<Backend, Omit<ExplorerCapabilityResult, 'available'>>
> = {
  addressHistory: {
    electrum: { fixKey: null, whyKey: null },
    esplora: { fixKey: null, whyKey: null },
    rpc: {
      fixKey: 'explorer.capability.addressHistory.rpc.fix',
      whyKey: 'explorer.capability.addressHistory.rpc.why'
    }
  },
  blockTxList: {
    electrum: {
      fixKey: 'explorer.capability.blockTxList.electrum.fix',
      whyKey: 'explorer.capability.blockTxList.electrum.why'
    },
    esplora: { fixKey: null, whyKey: null },
    rpc: { fixKey: null, whyKey: null }
  },
  difficultyAdjustment: {
    electrum: {
      fixKey: 'explorer.capability.difficultyAdjustment.fix',
      whyKey: 'explorer.capability.difficultyAdjustment.why'
    },
    esplora: {
      fixKey: 'explorer.capability.difficultyAdjustment.fix',
      whyKey: 'explorer.capability.difficultyAdjustment.why'
    },
    rpc: {
      fixKey: 'explorer.capability.difficultyAdjustment.fix',
      whyKey: 'explorer.capability.difficultyAdjustment.why'
    }
  },
  feeEstimates: {
    electrum: {
      fixKey: 'explorer.capability.feeEstimates.electrum.fix',
      whyKey: 'explorer.capability.feeEstimates.electrum.why'
    },
    esplora: { fixKey: null, whyKey: null },
    rpc: { fixKey: null, whyKey: null }
  },
  mempoolStats: {
    electrum: {
      fixKey: 'explorer.capability.mempoolStats.electrum.fix',
      whyKey: 'explorer.capability.mempoolStats.electrum.why'
    },
    esplora: { fixKey: null, whyKey: null },
    rpc: { fixKey: null, whyKey: null }
  },
  rawBlock: {
    electrum: {
      fixKey: 'explorer.capability.rawBlock.electrum.fix',
      whyKey: 'explorer.capability.rawBlock.electrum.why'
    },
    esplora: { fixKey: null, whyKey: null },
    rpc: { fixKey: null, whyKey: null }
  },
  txLookup: {
    electrum: { fixKey: null, whyKey: null },
    esplora: { fixKey: null, whyKey: null },
    rpc: {
      fixKey: 'explorer.capability.txLookup.rpc.fix',
      whyKey: 'explorer.capability.txLookup.rpc.why'
    }
  }
}

export function getExplorerCapability(
  backend: Backend,
  feature: ExplorerFeature
): ExplorerCapabilityResult {
  const keys = CAPABILITY_KEYS[feature][backend]
  const available = keys.whyKey === null
  return {
    available,
    fixKey: keys.fixKey,
    whyKey: keys.whyKey
  }
}

export function canViewBlockTransactions(backend: Backend): boolean {
  return backend === 'esplora' || backend === 'rpc'
}

export function formatExplorerBackendSource(
  name: string,
  backend: Backend
): string {
  return `${name} (${backend})`
}
