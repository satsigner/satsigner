import {
  ANIMATION_INTERVAL_FLOOR_MS,
  ANIMATION_INTERVAL_MAX_MS,
  ANIMATION_INTERVAL_MIN_MS,
  ANIMATION_SPEED_MAX,
  ANIMATION_SPEED_MIN,
  BBQR_CHUNK_BASE_SIZE,
  BBQR_CHUNK_MIN_SIZE,
  BBQR_SINGLE_CHUNK_MULTIPLIER,
  QR_COMPLEXITY_MAX,
  QR_ENCODING_OVERHEAD,
  QR_MAX_DATA_SIZE,
  RAW_CHUNK_BASE_SIZE,
  RAW_CHUNK_MAX_MULTIPLIER,
  UR_FRAGMENT_BASE_SIZE,
  UR_FRAGMENT_MIN_SIZE
} from '@/constants/qr'
import { BBQRFileTypes, createBBQRChunks } from '@/utils/bbqr'
import { getURFragmentsFromPSBT } from '@/utils/ur'

// The max complexity means "one static QR", unless the data cannot fit in one.
function isSingleStaticQr(complexity: number, encodedSize: number) {
  return complexity === QR_COMPLEXITY_MAX && encodedSize <= QR_MAX_DATA_SIZE
}

// Splits data into `p{i}of{N} <chunk>` QR frames. Higher complexity means
// larger chunks; max complexity returns the data unchunked when it fits.
export function createRawQrChunks(data: string, complexity: number) {
  if (isSingleStaticQr(complexity, data.length)) {
    return [data]
  }

  const chunkSize =
    RAW_CHUNK_BASE_SIZE * Math.min(complexity, RAW_CHUNK_MAX_MULTIPLIER)
  const dataChunks: string[] = []
  for (let i = 0; i < data.length; i += chunkSize) {
    dataChunks.push(data.slice(i, i + chunkSize))
  }
  return dataChunks.map(
    (chunk, index) => `p${index + 1}of${dataChunks.length} ${chunk}`
  )
}

// Encodes PSBT bytes as BBQR frames sized by complexity.
export function createBbqrPsbtChunks(psbtBytes: Uint8Array, complexity: number) {
  const chunkSize = isSingleStaticQr(
    complexity,
    psbtBytes.length * QR_ENCODING_OVERHEAD
  )
    ? psbtBytes.length * BBQR_SINGLE_CHUNK_MULTIPLIER
    : Math.max(BBQR_CHUNK_MIN_SIZE, BBQR_CHUNK_BASE_SIZE * complexity)
  return createBBQRChunks(psbtBytes, BBQRFileTypes.PSBT, chunkSize)
}

// Encodes a base64 PSBT as UR (crypto-psbt) fragments sized by complexity.
export function createUrPsbtFragments(psbtBase64: string, complexity: number) {
  const fragmentSize = isSingleStaticQr(
    complexity,
    psbtBase64.length * QR_ENCODING_OVERHEAD
  )
    ? psbtBase64.length
    : Math.max(UR_FRAGMENT_MIN_SIZE, UR_FRAGMENT_BASE_SIZE * complexity)
  return getURFragmentsFromPSBT(psbtBase64, 'base64', fragmentSize)
}

// Frame interval for an animated QR: speed min → slowest, speed max → fastest.
export function getQrAnimationIntervalMs(speed: number) {
  const interval =
    ANIMATION_INTERVAL_MAX_MS -
    ((speed - ANIMATION_SPEED_MIN) *
      (ANIMATION_INTERVAL_MAX_MS - ANIMATION_INTERVAL_MIN_MS)) /
      (ANIMATION_SPEED_MAX - ANIMATION_SPEED_MIN)
  return Math.max(interval, ANIMATION_INTERVAL_FLOOR_MS)
}
