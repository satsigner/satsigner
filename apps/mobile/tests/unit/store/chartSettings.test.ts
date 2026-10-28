import mmkvStorage from '@/storage/mmkv'
import { useBlockchainStore } from '@/store/blockchain'
import { useChartSettingStore } from '@/store/chartSettings'
import { type Server } from '@/types/settings/blockchain'

const OWN_NODE: Server = {
  backend: 'electrum',
  name: 'Own node',
  network: 'bitcoin',
  url: 'ssl://node.local:50002'
}

async function readPersistedState(name: string): Promise<unknown> {
  const raw = await mmkvStorage.getItem(name)
  return raw ? JSON.parse(raw) : null
}

describe('chart settings store - persistence', () => {
  it('keeps the persisted server config when a chart setting changes', async () => {
    useBlockchainStore.getState().updateServer('bitcoin', OWN_NODE)
    useChartSettingStore.getState().setShowLabel(false)

    const persisted = await readPersistedState(
      useBlockchainStore.persist.getOptions().name ?? ''
    )

    expect(persisted).toMatchObject({
      state: { configs: { bitcoin: { server: { url: OWN_NODE.url } } } }
    })
  })

  it('keeps the persisted chart settings when the server config changes', async () => {
    useChartSettingStore.getState().setShowAmount(false)
    useBlockchainStore.getState().updateServer('bitcoin', OWN_NODE)

    const persisted = await readPersistedState(
      useChartSettingStore.persist.getOptions().name ?? ''
    )

    expect(persisted).toMatchObject({ state: { showAmount: false } })
  })
})
