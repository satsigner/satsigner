import { BBQRFileTypes, createBBQRChunks, decodeBBQRChunks } from '@/utils/bbqr'
import { joinQRs } from '@/utils/bbrq'

const PAYLOAD_BYTES = 1500

function samplePayload() {
  return Uint8Array.from({ length: PAYLOAD_BYTES }, (_, i) => i % 251)
}

describe('bbqr chunks', () => {
  it('decodes the chunks it creates back into the same bytes', () => {
    const data = samplePayload()
    const chunks = createBBQRChunks(data, BBQRFileTypes.PSBT, 200)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.startsWith('B$'))).toBe(true)
    expect(decodeBBQRChunks(chunks)).toStrictEqual(data)
  })

  it('reports the encoding read from the header', () => {
    const [chunk] = createBBQRChunks(
      new TextEncoder().encode('hello'),
      BBQRFileTypes.UNICODE,
      1000
    )
    expect(['2', 'H', 'Z']).toContain(joinQRs([chunk]).encoding)
  })

  it('rejects a header with an unknown encoding', () => {
    expect(() => joinQRs(['B$QU0100abcd'])).toThrow('bad encoding: Q')
  })
})
