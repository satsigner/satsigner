import Esplora from '@/api/esplora'
import { type EsploraTx } from '@/types/models/Esplora'

const ADDRESS = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'

function tx(txid: string, confirmed = true): EsploraTx {
  return {
    fee: 250,
    locktime: 0,
    size: 200,
    status: { confirmed },
    txid,
    version: 2,
    vin: [],
    vout: [],
    weight: 800
  }
}

function page(prefix: string, size: number) {
  return Array.from({ length: size }, (_, index) => tx(`${prefix}${index}`))
}

function mockPages(...pages: EsploraTx[][]) {
  for (const body of pages) {
    jest.mocked(global.fetch).mockResolvedValueOnce({
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(body),
      ok: true
    })
  }
}

describe('getAddressTxs', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockReset()
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  it('pages through servers that return 25 confirmed txs per page', async () => {
    mockPages(page('a', 25), page('b', 25), page('c', 3))

    const txs = await new Esplora('https://x').getAddressTxs(ADDRESS)

    expect(txs).toHaveLength(53)
    expect(global.fetch).toHaveBeenCalledTimes(3)
    expect(jest.mocked(global.fetch).mock.calls[2][0]).toBe(
      `https://x/address/${ADDRESS}/txs?after_txid=b24`
    )
  })

  it('pages through servers that return 50 confirmed txs per page', async () => {
    mockPages(page('a', 50), page('b', 10))

    const txs = await new Esplora('https://x').getAddressTxs(ADDRESS)

    expect(txs).toHaveLength(60)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('does not count mempool txs towards a full page', async () => {
    mockPages([tx('m', false), ...page('a', 24)])

    const txs = await new Esplora('https://x').getAddressTxs(ADDRESS)

    expect(txs).toHaveLength(25)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('stops at a page of known txids', async () => {
    const first = page('a', 25)
    mockPages(first)

    await new Esplora('https://x').getAddressTxs(
      ADDRESS,
      new Set(first.map((t) => t.txid))
    )

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
