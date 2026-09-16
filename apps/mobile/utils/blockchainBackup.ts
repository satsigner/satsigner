import { useBlockchainStore } from '@/store/blockchain'
import type { Config, Network, Server } from '@/types/settings/blockchain'
import { NetworkSchema } from '@/types/settings/blockchain'
import { loadRpcCredentials } from '@/utils/serviceSecrets'

export const BLOCKCHAIN_BACKUP_NETWORKS: Network[] = NetworkSchema.options

export type BlockchainBackup = {
  configs: Partial<Record<Network, { config: Config; server: Server }>>
  configsMempool: Record<Network, string>
  customServers: Server[]
  selectedNetwork: Network
}

type BlockchainStoreSlice = Pick<
  ReturnType<typeof useBlockchainStore.getState>,
  | 'addCustomServer'
  | 'configs'
  | 'configsMempool'
  | 'customServers'
  | 'removeCustomServer'
  | 'selectedNetwork'
  | 'setSelectedNetwork'
  | 'updateConfig'
  | 'updateConfigMempool'
  | 'updateServer'
>

async function serverWithRpcCredentials(server: Server, network: Network) {
  if (server.rpcCredentials?.username || server.rpcCredentials?.password) {
    return server
  }
  const loaded = await loadRpcCredentials(network)
  if (!loaded) {
    return server
  }
  return {
    ...server,
    rpcCredentials: loaded
  }
}

async function collectNetworkConfig(
  state: Pick<BlockchainStoreSlice, 'configs'>,
  network: Network
) {
  const current = state.configs[network]
  if (!current?.config || !current.server) {
    return null
  }
  return {
    config: current.config,
    server: await serverWithRpcCredentials(current.server, network)
  }
}

export async function collectBlockchainBackup(
  state: Pick<
    BlockchainStoreSlice,
    'configs' | 'configsMempool' | 'customServers' | 'selectedNetwork'
  >
): Promise<BlockchainBackup> {
  const [bitcoin, testnet, signet] = await Promise.all([
    collectNetworkConfig(state, 'bitcoin'),
    collectNetworkConfig(state, 'testnet'),
    collectNetworkConfig(state, 'signet')
  ])
  return {
    configs: {
      bitcoin: bitcoin ?? undefined,
      signet: signet ?? undefined,
      testnet: testnet ?? undefined
    },
    configsMempool: state.configsMempool,
    customServers: state.customServers,
    selectedNetwork: state.selectedNetwork
  }
}

export function restoreBlockchainFromBackup(
  backup: BlockchainBackup,
  store: BlockchainStoreSlice = useBlockchainStore.getState()
): void {
  store.setSelectedNetwork(backup.selectedNetwork)
  for (const network of BLOCKCHAIN_BACKUP_NETWORKS) {
    const mempool = backup.configsMempool?.[network]
    if (typeof mempool === 'string') {
      store.updateConfigMempool(network, mempool)
    }
    const incoming = backup.configs[network]
    if (!incoming) {
      continue
    }
    const current = store.configs[network]
    if (!current?.server || !current.config) {
      continue
    }
    store.updateServer(network, {
      ...current.server,
      ...incoming.server
    })
    store.updateConfig(network, {
      ...current.config,
      ...incoming.config
    })
  }
  const existingServers = store.customServers.slice()
  for (const old of existingServers) {
    store.removeCustomServer(old)
  }
  for (const server of backup.customServers) {
    store.addCustomServer(server)
  }
}
