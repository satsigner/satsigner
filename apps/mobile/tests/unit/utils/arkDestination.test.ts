import { decode } from 'bitcoin-decoder'

import { parseArkDestination } from '@/utils/arkDestination'

jest.mock<typeof import('bitcoin-decoder')>('bitcoin-decoder', () => ({
  decode: jest.fn()
}))

const decodeMock = jest.mocked(decode)

function mockDecoded(
  type: string,
  value: string,
  metadata?: { amount?: number; description?: string }
) {
  decodeMock.mockResolvedValue({
    destination: { type, value },
    kind: 'payment',
    metadata,
    valid: true
  } as Awaited<ReturnType<typeof decode>>)
}

describe('parseArkDestination', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects empty input without calling the decoder', async () => {
    await expect(parseArkDestination('')).resolves.toStrictEqual({
      ok: false,
      reason: 'invalid'
    })
    await expect(parseArkDestination('   ')).resolves.toStrictEqual({
      ok: false,
      reason: 'invalid'
    })
    expect(decodeMock).not.toHaveBeenCalled()
  })

  it('rejects input the decoder marks invalid', async () => {
    decodeMock.mockResolvedValue({ valid: false } as Awaited<
      ReturnType<typeof decode>
    >)
    await expect(parseArkDestination('garbage')).resolves.toStrictEqual({
      ok: false,
      reason: 'invalid'
    })
  })

  it('reports valid non-payment decodes (nostr, psbt, key, transaction) as unsupported', async () => {
    decodeMock.mockResolvedValue({ kind: 'nostr', valid: true } as Awaited<
      ReturnType<typeof decode>
    >)
    await expect(parseArkDestination('npub1xyz')).resolves.toStrictEqual({
      ok: false,
      reason: 'unsupported'
    })
  })

  it('classifies an ark address as arkoor', async () => {
    mockDecoded('ark-address', 'ark1qxyz')
    await expect(parseArkDestination('ark1qxyz')).resolves.toStrictEqual({
      draft: { address: 'ark1qxyz', kind: 'arkoor' },
      ok: true
    })
  })

  it('classifies a bolt11 invoice and forwards amount and description', async () => {
    mockDecoded('bolt11', 'lnbc1invoice', {
      amount: 2100,
      description: 'coffee'
    })
    await expect(parseArkDestination('lnbc1invoice')).resolves.toStrictEqual({
      draft: {
        amountSatsFromInvoice: 2100,
        description: 'coffee',
        invoice: 'lnbc1invoice',
        kind: 'bolt11'
      },
      ok: true
    })
  })

  it('classifies an amountless bolt11 invoice without a pre-filled amount', async () => {
    mockDecoded('bolt11', 'lnbc1amountless')
    await expect(parseArkDestination('lnbc1amountless')).resolves.toStrictEqual(
      {
        draft: {
          amountSatsFromInvoice: undefined,
          description: undefined,
          invoice: 'lnbc1amountless',
          kind: 'bolt11'
        },
        ok: true
      }
    )
  })

  it('classifies a lightning address', async () => {
    mockDecoded('lnaddress', 'user@ln.example')
    await expect(parseArkDestination('user@ln.example')).resolves.toStrictEqual(
      {
        draft: { address: 'user@ln.example', kind: 'lnaddress' },
        ok: true
      }
    )
  })

  it('classifies an LNURL', async () => {
    mockDecoded('lnurl', 'lnurl1encoded')
    await expect(parseArkDestination('lnurl1encoded')).resolves.toStrictEqual({
      draft: { kind: 'lnurl', lnurl: 'lnurl1encoded' },
      ok: true
    })
  })

  it('classifies a bitcoin address as onchain', async () => {
    mockDecoded('bitcoin-address', 'tb1qaddress')
    await expect(parseArkDestination('tb1qaddress')).resolves.toStrictEqual({
      draft: { address: 'tb1qaddress', kind: 'onchain' },
      ok: true
    })
  })

  it('reports unknown destination types as unsupported', async () => {
    mockDecoded('silent-payment', 'sp1qsomething')
    await expect(parseArkDestination('sp1qsomething')).resolves.toStrictEqual({
      ok: false,
      reason: 'unsupported'
    })
  })
})
