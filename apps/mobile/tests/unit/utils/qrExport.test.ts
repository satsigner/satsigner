import {
  ANIMATION_INTERVAL_FLOOR_MS,
  ANIMATION_INTERVAL_MAX_MS,
  ANIMATION_INTERVAL_MIN_MS,
  ANIMATION_SPEED_MAX,
  ANIMATION_SPEED_MIN,
  QR_COMPLEXITY_MAX,
  QR_MAX_DATA_SIZE,
  RAW_CHUNK_BASE_SIZE
} from '@/constants/qr'
import { createRawQrChunks, getQrAnimationIntervalMs } from '@/utils/qrExport'

describe('createRawQrChunks', () => {
  it('returns the data unchunked at max complexity when it fits', () => {
    expect(createRawQrChunks('cHNidP8B', QR_COMPLEXITY_MAX)).toStrictEqual([
      'cHNidP8B'
    ])
  })

  it('chunks with a pNofM header sized by complexity', () => {
    const data = 'a'.repeat(RAW_CHUNK_BASE_SIZE * 2 + 1)
    const chunks = createRawQrChunks(data, 1)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toBe(`p1of3 ${'a'.repeat(RAW_CHUNK_BASE_SIZE)}`)
    expect(chunks[2]).toBe('p3of3 a')
  })

  it('chunks at max complexity when the data cannot fit one QR', () => {
    const data = 'a'.repeat(QR_MAX_DATA_SIZE + 1)
    expect(createRawQrChunks(data, QR_COMPLEXITY_MAX).length).toBeGreaterThan(1)
  })

  it('reassembles to the original data', () => {
    const data = 'abcdefghij'.repeat(50)
    const reassembled = createRawQrChunks(data, 2)
      .map((chunk) => chunk.replace(/^p\d+of\d+ /, ''))
      .join('')
    expect(reassembled).toBe(data)
  })
})

describe('getQrAnimationIntervalMs', () => {
  it('maps speed min/max to the slowest/fastest interval', () => {
    expect(getQrAnimationIntervalMs(ANIMATION_SPEED_MIN)).toBe(
      ANIMATION_INTERVAL_MAX_MS
    )
    expect(getQrAnimationIntervalMs(ANIMATION_SPEED_MAX)).toBe(
      ANIMATION_INTERVAL_MIN_MS
    )
  })

  it('never goes below the frame floor', () => {
    expect(getQrAnimationIntervalMs(ANIMATION_SPEED_MAX * 10)).toBe(
      ANIMATION_INTERVAL_FLOOR_MS
    )
  })
})
