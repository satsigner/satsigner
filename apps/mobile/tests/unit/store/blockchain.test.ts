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

describe('blockchain store - setSelectedNetwork', () => {
  it('forgets the next-block fee of the network it leaves', () => {
    const store = useBlockchainStore.getState()
    store.setSelectedNetwork('testnet')
    store.setNextBlockFee(80)

    store.setSelectedNetwork('bitcoin')

    expect(useBlockchainStore.getState().nextBlockFee).toBeNull()
  })

  it('forgets the chain tip of the network it leaves', () => {
    const store = useBlockchainStore.getState()
    store.setSelectedNetwork('signet')
    store.setLastKnownBlockHeight(330_361)

    store.setSelectedNetwork('bitcoin')

    expect(useBlockchainStore.getState().lastKnownBlockHeight).toBe(0)
  })

  it('keeps the fee when the same network is selected again', () => {
    const store = useBlockchainStore.getState()
    store.setSelectedNetwork('signet')
    store.setNextBlockFee(3)

    store.setSelectedNetwork('signet')

    expect(useBlockchainStore.getState().nextBlockFee).toBe(3)
  })
})
