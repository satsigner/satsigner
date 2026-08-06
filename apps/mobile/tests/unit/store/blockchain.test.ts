import { useBlockchainStore } from '@/store/blockchain'
import { type Server } from '@/types/settings/blockchain'

const CREDENTIALS = { password: 'hunter2', username: 'satoshi' }

describe('blockchain store - stripAllRpcCredentials', () => {
  it('removes rpcCredentials from every network config and every custom server', () => {
    const { updateServer, addCustomServer, stripAllRpcCredentials } =
      useBlockchainStore.getState()

    updateServer('bitcoin', {
      backend: 'rpc',
      name: 'Node',
      network: 'bitcoin',
      rpcCredentials: CREDENTIALS,
      url: 'http://localhost:8332'
    })

    const customServer: Server = {
      backend: 'rpc',
      name: 'Custom Node',
      network: 'signet',
      rpcCredentials: CREDENTIALS,
      url: 'http://localhost:38332'
    }
    addCustomServer(customServer)

    stripAllRpcCredentials()

    const state = useBlockchainStore.getState()
    for (const network of ['bitcoin', 'testnet', 'signet'] as const) {
      expect(state.configs[network].server.rpcCredentials).toBeUndefined()
    }
    for (const server of state.customServers) {
      expect(server.rpcCredentials).toBeUndefined()
    }
    expect(state.customServers.length).toBeGreaterThan(0)
  })
})
