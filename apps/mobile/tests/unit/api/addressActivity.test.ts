import { readAddressActivity } from '@/api/addressActivity'
import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import type { EsploraTx } from '@/types/models/Esplora'
import type { Server } from '@/types/settings/blockchain'

jest.mock<typeof import('@/api/electrumReachability')>(
  '@/api/electrumReachability',
  () => ({
    ...jest.requireActual<typeof import('@/api/electrumReachability')>(
      '@/api/electrumReachability'
    ),
    assertElectrumReachable: jest.fn(() => Promise.resolve())
  })
)

const ELECTRUM: Server = {
  backend: 'electrum',
  name: 'electrum',
  network: 'signet',
  url: 'ssl://electrum.example.com:50002'
}

const ESPLORA: Server = {
  backend: 'esplora',
  name: 'esplora',
  network: 'signet',
  url: 'https://esplora.example.com/api'
}

function stubElectrum(
  histories: Awaited<ReturnType<ElectrumClient['getAddressHistories']>>
) {
  const client = ElectrumClient.fromUrl(ELECTRUM.url, ELECTRUM.network)
  const close = jest.spyOn(client, 'close').mockImplementation()
  const getAddressHistories = jest
    .spyOn(client, 'getAddressHistories')
    .mockResolvedValue(histories)
  jest.spyOn(ElectrumClient, 'initClientFromUrl').mockResolvedValue(client)
  return { close, getAddressHistories }
}

describe('readAddressActivity on Electrum', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('splits confirmed and unconfirmed history and closes the client', async () => {
    const { close, getAddressHistories } = stubElectrum([
      [
        { height: 100, tx_hash: 'confirmed' },
        { height: 0, tx_hash: 'mempool' }
      ],
      []
    ])

    const activity = await readAddressActivity(ELECTRUM, ['a', 'b'])

    expect(getAddressHistories).toHaveBeenCalledWith(['a', 'b'])
    expect(activity).toStrictEqual([
      { address: 'a', confirmedCount: 1, unconfirmedTxids: ['mempool'] },
      { address: 'b', confirmedCount: 0, unconfirmedTxids: [] }
    ])
    expect(close).toHaveBeenCalledWith()
  })

  it('stops between batches once cancelled', async () => {
    const { close, getAddressHistories } = stubElectrum([])
    const controller = new AbortController()
    controller.abort()

    await expect(
      readAddressActivity(ELECTRUM, ['a'], { signal: controller.signal })
    ).rejects.toThrow('cancelled')
    expect(getAddressHistories).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledWith()
  })
})

function mempoolTx(txid: string): EsploraTx {
  return {
    fee: 0,
    locktime: 0,
    size: 0,
    status: { confirmed: false },
    txid,
    version: 2,
    vin: [],
    vout: [],
    weight: 0
  }
}

describe('readAddressActivity on Esplora', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('reads counts, and mempool txids only where there are some', async () => {
    jest
      .spyOn(Esplora.prototype, 'getAddressTxCounts')
      .mockImplementation((address: string) =>
        Promise.resolve(
          address === 'a'
            ? { confirmed: 2, mempool: 1 }
            : { confirmed: 0, mempool: 0 }
        )
      )
    const mempool = jest
      .spyOn(Esplora.prototype, 'getAddressTxsInMempool')
      .mockResolvedValue([mempoolTx('pending')])

    const activity = await readAddressActivity(ESPLORA, ['a', 'b'])

    expect(activity).toStrictEqual([
      { address: 'a', confirmedCount: 2, unconfirmedTxids: ['pending'] },
      { address: 'b', confirmedCount: 0, unconfirmedTxids: [] }
    ])
    expect(mempool).toHaveBeenCalledTimes(1)
  })
})

describe('readAddressActivity on Bitcoin Core', () => {
  it('is not supported', async () => {
    await expect(
      readAddressActivity({ ...ELECTRUM, backend: 'rpc' }, ['a'])
    ).rejects.toThrow('Electrum or Esplora')
  })
})
