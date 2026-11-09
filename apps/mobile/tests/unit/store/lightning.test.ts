import { useLightningStore } from '@/store/lightning'
import type { LNDConfig } from '@/types/models/Lightning'

jest.mock<typeof import('@/utils/serviceSecrets')>(
  '@/utils/serviceSecrets',
  () => ({
    ...jest.requireActual<typeof import('@/utils/serviceSecrets')>(
      '@/utils/serviceSecrets'
    ),
    deleteLndSecretsSafe: jest.fn(),
    persistLndSecretsSafe: jest.fn()
  })
)

function config(url: string): LNDConfig {
  return { cert: '', macaroon: 'aa', url }
}

describe('lightning store', () => {
  beforeEach(() => {
    useLightningStore.getState().clearConfig()
  })

  it('stays connecting until the last of several requests settles', () => {
    const store = useLightningStore.getState()
    store.setConnecting(true)
    store.setConnecting(true)
    store.setConnecting(false)
    expect(useLightningStore.getState().status.isConnecting).toBe(true)

    store.setConnecting(false)
    expect(useLightningStore.getState().status.isConnecting).toBe(false)
  })

  it('drops the previous node status when a different node is paired', () => {
    const store = useLightningStore.getState()
    store.setConfig(config('https://node-a.example'))
    store.setConnected(true)
    store.setChannels([])

    store.setConfig(config('https://node-b.example'))

    expect(useLightningStore.getState().status).toStrictEqual({
      isConnected: false,
      isConnecting: false
    })
  })

  it('keeps the status when the same node is saved again', () => {
    const store = useLightningStore.getState()
    store.setConfig(config('https://node-a.example'))
    store.setConnected(true)

    store.setConfig(config('https://node-a.example'))

    expect(useLightningStore.getState().status.isConnected).toBe(true)
  })
})
