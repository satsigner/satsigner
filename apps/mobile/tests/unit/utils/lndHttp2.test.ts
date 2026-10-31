import { Buffer } from 'buffer'

import {
  http2WindowUpdates,
  statusFromHpackHeaders,
  takeHttp2Frames
} from '@/utils/lndHttp2'

const FRAME_WINDOW_UPDATE = 0x08

describe('statusFromHpackHeaders', () => {
  it('reads a fully indexed status', () => {
    expect(statusFromHpackHeaders(Buffer.from([0x88]))).toBe(200)
  })

  it('reads a status after a dynamic table size update', () => {
    expect(statusFromHpackHeaders(Buffer.from([0x20, 0x88]))).toBe(200)
  })

  it('reads a Huffman-encoded status the way Go encodes it', () => {
    // Literal with incremental indexing, name index 14, Huffman "401".
    expect(statusFromHpackHeaders(Buffer.from([0x4e, 0x82, 0x68, 0x01]))).toBe(
      401
    )
  })

  it('reads a Huffman-encoded status with EOS padding', () => {
    // Huffman "503" is 17 bits, padded with seven 1 bits.
    expect(
      statusFromHpackHeaders(Buffer.from([0x4e, 0x83, 0x6c, 0x0c, 0xff]))
    ).toBe(503)
  })

  it('reads a plain literal status with any :status name index', () => {
    expect(
      statusFromHpackHeaders(Buffer.from([0x18, 0x03, ...Buffer.from('403')]))
    ).toBe(403)
  })

  it('reads a status with a literal :status name', () => {
    expect(
      statusFromHpackHeaders(
        Buffer.from([
          0x00,
          0x07,
          ...Buffer.from(':status'),
          0x03,
          ...Buffer.from('503')
        ])
      )
    ).toBe(503)
  })

  it('returns null for a Huffman value that is not a status', () => {
    // Huffman "a" plus padding.
    expect(statusFromHpackHeaders(Buffer.from([0x4e, 0x81, 0x1f]))).toBeNull()
  })

  it('returns null when Huffman padding is a full byte', () => {
    expect(
      statusFromHpackHeaders(Buffer.from([0x4e, 0x83, 0x68, 0x01, 0xff]))
    ).toBeNull()
  })

  it('returns null without a status header', () => {
    expect(statusFromHpackHeaders(Buffer.alloc(0))).toBeNull()
  })
})

describe('http2WindowUpdates', () => {
  it('credits the connection and the stream with the consumed bytes', () => {
    const { frames, rest } = takeHttp2Frames(http2WindowUpdates(1, 70_000))

    expect(rest).toHaveLength(0)
    expect(frames.map((frame) => frame.type)).toStrictEqual([
      FRAME_WINDOW_UPDATE,
      FRAME_WINDOW_UPDATE
    ])
    expect(frames.map((frame) => frame.streamId)).toStrictEqual([0, 1])
    expect(frames.map((frame) => frame.payload.readUInt32BE(0))).toStrictEqual([
      70_000, 70_000
    ])
  })
})
