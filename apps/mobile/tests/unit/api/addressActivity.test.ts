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

describe('readAddressActivity cancelling an Electrum request', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('rejects and closes the socket when cancelled mid-request', async () => {
    const client = ElectrumClient.fromUrl(ELECTRUM.url, ELECTRUM.network)
    const pending =
      Promise.withResolvers<
        Awaited<ReturnType<ElectrumClient['getAddressHistories']>>
      >()
    const close = jest.spyOn(client, 'close').mockImplementation()
    jest.spyOn(client, 'getAddressHistories').mockReturnValue(pending.promise)
    jest.spyOn(ElectrumClient, 'initClientFromUrl').mockResolvedValue(client)
    const controller = new AbortController()

    const read = readAddressActivity(ELECTRUM, ['a'], {
      signal: controller.signal
    })
    await Promise.resolve()
    await Promise.resolve()
    controller.abort()

    await expect(read).rejects.toThrow('cancelled')
    expect(close).toHaveBeenCalledWith()
    // The closed socket rejects the request; that late rejection is handled.
    pending.reject(new Error('close connect'))
  })
})

const ADDRESS_A = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
const ADDRESS_B =
  'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7'

describe('electrumClient.getAddressHistories', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  type BatchAnswer = Awaited<
    ReturnType<ElectrumClient['client']['blockchainScripthash_getHistoryBatch']>
  >

  function clientAnswering(answer: BatchAnswer) {
    const client = ElectrumClient.fromUrl(ELECTRUM.url, ELECTRUM.network)
    jest
      .spyOn(client.client, 'blockchainScripthash_getHistoryBatch')
      .mockResolvedValue(answer)
    return client
  }

  it('matches results to addresses by scripthash, not by order', async () => {
    const probe = ElectrumClient.fromUrl(ELECTRUM.url, ELECTRUM.network)
    const hashA = probe.addressToScriptHash(ADDRESS_A)
    const hashB = probe.addressToScriptHash(ADDRESS_B)
    const client = clientAnswering([
      { param: hashB, result: [{ height: 5, tx_hash: 'b-tx' }] },
      { param: hashA, result: [] }
    ])

    await expect(
      client.getAddressHistories([ADDRESS_A, ADDRESS_B])
    ).resolves.toStrictEqual([[], [{ height: 5, tx_hash: 'b-tx' }]])
  })

  it('rejects when an address has no answer', async () => {
    const probe = ElectrumClient.fromUrl(ELECTRUM.url, ELECTRUM.network)
    const client = clientAnswering([
      { param: probe.addressToScriptHash(ADDRESS_A), result: [] }
    ])

    await expect(
      client.getAddressHistories([ADDRESS_A, ADDRESS_B])
    ).rejects.toThrow('did not return an address history')
  })

  it('rejects when the server answers an address with an error', async () => {
    const probe = ElectrumClient.fromUrl(ELECTRUM.url, ELECTRUM.network)
    const client = clientAnswering([
      {
        error: { message: 'history too large' },
        param: probe.addressToScriptHash(ADDRESS_A)
      }
    ])

    await expect(client.getAddressHistories([ADDRESS_A])).rejects.toThrow(
      'did not return an address history'
    )
  })
})

describe('esplora.getAddressTxCounts', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('reads confirmed and mempool counts', async () => {
    const esplora = new Esplora(ESPLORA.url)
    jest.spyOn(esplora, 'getAddress').mockResolvedValue({
      chain_stats: { tx_count: 3 },
      mempool_stats: { tx_count: 1 }
    })

    await expect(esplora.getAddressTxCounts(ADDRESS_A)).resolves.toStrictEqual({
      confirmed: 3,
      mempool: 1
    })
  })

  it.each([
    ['negative', -1],
    ['fractional', 1.5],
    ['missing', undefined]
  ])('rejects a %s tx_count', async (_case, txCount) => {
    const esplora = new Esplora(ESPLORA.url)
    jest.spyOn(esplora, 'getAddress').mockResolvedValue({
      chain_stats: { tx_count: txCount },
      mempool_stats: { tx_count: 0 }
    })

    await expect(esplora.getAddressTxCounts(ADDRESS_A)).rejects.toThrow(
      'tx_count'
    )
  })
})
