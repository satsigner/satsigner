import {
  ANIMATION_INTERVAL_FLOOR_MS,
  ANIMATION_INTERVAL_MAX_MS,
  ANIMATION_INTERVAL_MIN_MS,
  ANIMATION_SPEED_MAX,
  ANIMATION_SPEED_MIN,
  QR_COMPLEXITY_MAX,
  QR_MAX_DATA_SIZE,
  QRDisplayMode,
  RAW_CHUNK_BASE_SIZE
} from '@/constants/qr'
import {
  createPsbtQrChunks,
  createRawQrChunks,
  getQrAnimationIntervalMs,
  getQrDisplayModeDescription,
  getQrValue
} from '@/utils/qrExport'

const PSBT_BASE64 =
  'cHNidP8BAHECAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP////8AAAAA'

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

describe('createPsbtQrChunks', () => {
  it('encodes the PSBT in every display mode', () => {
    const chunks = createPsbtQrChunks(PSBT_BASE64, QR_COMPLEXITY_MAX)
    expect(chunks[QRDisplayMode.RAW]).toStrictEqual([PSBT_BASE64])
    expect(chunks[QRDisplayMode.UR].length).toBeGreaterThan(0)
    expect(chunks[QRDisplayMode.BBQR].length).toBeGreaterThan(0)
  })
})

describe('getQrValue', () => {
  it('returns the frame when it fits one QR', () => {
    expect(getQrValue('p1of2 abc')).toBe('p1of2 abc')
  })

  it('returns a placeholder without a frame or when it is too large', () => {
    expect(getQrValue(undefined)).toBe('NO_DATA')
    expect(getQrValue('a'.repeat(QR_MAX_DATA_SIZE + 1))).toBe(
      'DATA_TOO_LARGE_FOR_QR'
    )
  })
})

describe('getQrDisplayModeDescription', () => {
  const base = {
    chunkCount: 1,
    currentChunk: 0,
    displayMode: QRDisplayMode.UR,
    qrComplexity: QR_COMPLEXITY_MAX
  }

  it('shows the frame being displayed of an animated QR', () => {
    expect(
      getQrDisplayModeDescription({ ...base, chunkCount: 3, currentChunk: 1 })
    ).toStrictEqual({
      key: 'transaction.preview.scanAllChunks',
      params: { current: 2, total: 3 }
    })
  })

  it('names the static QR format at max density', () => {
    expect(getQrDisplayModeDescription(base)).toStrictEqual({
      key: 'transaction.preview.staticQrUr'
    })
  })

  it('notes a single chunk below max density', () => {
    expect(
      getQrDisplayModeDescription({ ...base, qrComplexity: 1 })
    ).toStrictEqual({ key: 'transaction.preview.singleChunk' })
  })

  it('reports a missing PSBT without frames', () => {
    expect(
      getQrDisplayModeDescription({ ...base, chunkCount: 0 })
    ).toStrictEqual({ key: 'error.psbt.notAvailable' })
  })
})
