import { parseZapReceiptFromTags, requestZapInvoice } from '@/utils/nostrZap'

const RECEIPT_ID = 'r'.repeat(64)
const ZAPPER = 'a'.repeat(64)
const RECIPIENT = 'b'.repeat(64)
const CREATED_AT = 1700000000
const CALLBACK_URL = 'https://ln.example/callback'

function receiptTags(zapRequest: unknown): string[][] {
  return [
    ['p', RECIPIENT],
    ['description', JSON.stringify(zapRequest)]
  ]
}

function mockFetchJsonOnce(body: unknown) {
  jest.mocked(global.fetch).mockResolvedValueOnce({
    json: () => Promise.resolve(body),
    ok: true
  })
}

describe('parseZapReceiptFromTags', () => {
  it('reads the zapper, comment and amount from the zap request', () => {
    const receipt = parseZapReceiptFromTags(
      RECEIPT_ID,
      CREATED_AT,
      receiptTags({
        content: 'great post',
        pubkey: ZAPPER,
        tags: [['amount', '21000']]
      }),
      null
    )

    expect(receipt).toMatchObject({
      amountSats: 21,
      comment: 'great post',
      direction: 'incoming',
      id: RECEIPT_ID,
      senderPubkey: ZAPPER
    })
  })

  it('classifies receipts zapped by the profile as outgoing', () => {
    const receipt = parseZapReceiptFromTags(
      RECEIPT_ID,
      CREATED_AT,
      receiptTags({ pubkey: ZAPPER }),
      ZAPPER
    )

    expect(receipt?.direction).toBe('outgoing')
    expect(receipt?.recipientPubkey).toBe(RECIPIENT)
  })

  it('returns null when the zap request has no usable pubkey', () => {
    expect(
      parseZapReceiptFromTags(RECEIPT_ID, CREATED_AT, receiptTags([]), null)
    ).toBeNull()
    expect(
      parseZapReceiptFromTags(
        RECEIPT_ID,
        CREATED_AT,
        receiptTags({ pubkey: 42 }),
        null
      )
    ).toBeNull()
    expect(
      parseZapReceiptFromTags(
        RECEIPT_ID,
        CREATED_AT,
        [['description', 'not json']],
        null
      )
    ).toBeNull()
  })

  it('tolerates malformed optional zap request fields', () => {
    const receipt = parseZapReceiptFromTags(
      RECEIPT_ID,
      CREATED_AT,
      receiptTags({ content: 7, pubkey: ZAPPER, tags: [null] }),
      null
    )

    expect(receipt?.senderPubkey).toBe(ZAPPER)
    expect(receipt?.amountSats).toBe(0)
    expect(receipt?.comment).toBeUndefined()
  })
})

describe('requestZapInvoice', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(global, 'fetch').mockImplementation()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  it('returns the invoice from the LNURL callback', async () => {
    mockFetchJsonOnce({ pr: 'lnbc210n1invoice' })

    await expect(requestZapInvoice(CALLBACK_URL, 21, '{}')).resolves.toBe(
      'lnbc210n1invoice'
    )
  })

  it('rejects responses without a string invoice', async () => {
    mockFetchJsonOnce({ pr: 42 })
    await expect(requestZapInvoice(CALLBACK_URL, 21, '{}')).rejects.toThrow(
      'No invoice returned from LNURL callback'
    )

    mockFetchJsonOnce(null)
    await expect(requestZapInvoice(CALLBACK_URL, 21, '{}')).rejects.toThrow(
      'No invoice returned from LNURL callback'
    )
  })
})
