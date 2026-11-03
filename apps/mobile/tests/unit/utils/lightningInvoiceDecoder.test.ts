import { decodeLightningInvoice } from '@/utils/lightningInvoiceDecoder'

// BOLT 11 spec test vector: "Please make a donation of any amount using
// payment_hash 0001020304... to me @03e7156ae33b0a208d0744199163177e909e80176e55d97a2f221ede0f934dd9ad"
const SPEC_INVOICE =
  'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql'
const SPEC_PAYMENT_HASH =
  '0001020304050607080900010203040506070809000102030405060708090102'
const SPEC_PAYMENT_SECRET =
  '1111111111111111111111111111111111111111111111111111111111111111'

describe('decodeLightningInvoice', () => {
  it('returns the payment hash and secret as hex', () => {
    const decoded = decodeLightningInvoice(SPEC_INVOICE)
    expect(decoded.payment_hash).toBe(SPEC_PAYMENT_HASH)
    expect(decoded.payment_secret).toBe(SPEC_PAYMENT_SECRET)
  })
})
