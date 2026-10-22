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
  QR_VALUE_NO_DATA,
  QR_VALUE_TOO_LARGE,
  QRDisplayMode,
  RAW_CHUNK_BASE_SIZE,
  RAW_CHUNK_MAX_MULTIPLIER,
  UR_FRAGMENT_BASE_SIZE,
  UR_FRAGMENT_MIN_SIZE
} from '@/constants/qr'
import { type PsbtQrChunks } from '@/types/models/Psbt'
import { type Message } from '@/types/ui/notice'
import { BBQRFileTypes, createBBQRChunks, isBBQRFragment } from '@/utils/bbqr'
import { getURFragmentsFromPSBT } from '@/utils/ur'

const STATIC_QR_DESCRIPTION_KEYS: Record<QRDisplayMode, string> = {
  [QRDisplayMode.BBQR]: 'transaction.preview.staticQrBbqr',
  [QRDisplayMode.RAW]: 'transaction.preview.staticQrPsbt',
  [QRDisplayMode.UR]: 'transaction.preview.staticQrUr'
}

type QrDisplayModeDescriptionParams = {
  chunkCount: number
  currentChunk: number
  displayMode: QRDisplayMode
  qrComplexity: number
}

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
  const dataChunks = Array.from(
    { length: Math.ceil(data.length / chunkSize) },
    (_, index) => data.slice(index * chunkSize, (index + 1) * chunkSize)
  )
  return dataChunks.map(
    (chunk, index) => `p${index + 1}of${dataChunks.length} ${chunk}`
  )
}

function everyFrameFitsInQr(frames: string[]) {
  return frames.every((frame) => frame.length <= QR_MAX_DATA_SIZE)
}

// Encodes PSBT bytes as BBQR frames sized by complexity.
export function createBbqrPsbtChunks(
  psbtBytes: Uint8Array,
  complexity: number
) {
  const multiPartChunks = () =>
    createBBQRChunks(
      psbtBytes,
      BBQRFileTypes.PSBT,
      Math.max(BBQR_CHUNK_MIN_SIZE, BBQR_CHUNK_BASE_SIZE * complexity)
    )
  if (!isSingleStaticQr(complexity, psbtBytes.length * QR_ENCODING_OVERHEAD)) {
    return multiPartChunks()
  }
  const singleChunk = createBBQRChunks(
    psbtBytes,
    BBQRFileTypes.PSBT,
    psbtBytes.length * BBQR_SINGLE_CHUNK_MULTIPLIER
  )
  return everyFrameFitsInQr(singleChunk) ? singleChunk : multiPartChunks()
}

// Encodes a base64 PSBT as UR (crypto-psbt) fragments sized by complexity.
export function createUrPsbtFragments(psbtBase64: string, complexity: number) {
  const multiPartFragments = () =>
    getURFragmentsFromPSBT(
      psbtBase64,
      'base64',
      Math.max(UR_FRAGMENT_MIN_SIZE, UR_FRAGMENT_BASE_SIZE * complexity)
    )
  if (!isSingleStaticQr(complexity, psbtBase64.length * QR_ENCODING_OVERHEAD)) {
    return multiPartFragments()
  }
  const singleFragment = getURFragmentsFromPSBT(
    psbtBase64,
    'base64',
    psbtBase64.length
  )
  return everyFrameFitsInQr(singleFragment)
    ? singleFragment
    : multiPartFragments()
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

// BBQR chunks of the PSBT, or none when the payload cannot be BBQR encoded
// (including the non-BBQR fallback chunks createBBQRChunks returns).
function createBbqrPsbtChunksOrEmpty(
  psbtBytes: Uint8Array,
  complexity: number
) {
  try {
    const chunks = createBbqrPsbtChunks(psbtBytes, complexity)
    return chunks.every(isBBQRFragment) ? chunks : []
  } catch {
    return []
  }
}

// Encodes a base64 PSBT in every QR export format. Only the decoded byte copy
// used for BBQR is zeroed; the base64 string and the chunks stay in memory.
export function createPsbtQrChunks(
  psbtBase64: string,
  complexity: number
): PsbtQrChunks {
  const psbtBytes = new Uint8Array(Buffer.from(psbtBase64, 'base64'))
  const bbqrChunks = createBbqrPsbtChunksOrEmpty(psbtBytes, complexity)
  psbtBytes.fill(0)
  return {
    [QRDisplayMode.BBQR]: bbqrChunks,
    [QRDisplayMode.RAW]: createRawQrChunks(psbtBase64, complexity),
    [QRDisplayMode.UR]: createUrPsbtFragments(psbtBase64, complexity)
  }
}

// The value to encode in the QR for a frame, or a placeholder when there is no
// frame or it is too large for one QR.
export function getQrValue(chunk: string | undefined) {
  if (!chunk) {
    return QR_VALUE_NO_DATA
  }
  return chunk.length > QR_MAX_DATA_SIZE ? QR_VALUE_TOO_LARGE : chunk
}

// Caption under the QR: which frame of an animated QR is shown, or what kind of
// static QR it is.
export function getQrDisplayModeDescription({
  chunkCount,
  currentChunk,
  displayMode,
  qrComplexity
}: QrDisplayModeDescriptionParams): Message {
  if (chunkCount === 0) {
    return { key: 'error.psbt.notAvailable' }
  }
  if (chunkCount > 1) {
    return {
      key: 'transaction.preview.scanAllChunks',
      params: { current: currentChunk + 1, total: chunkCount }
    }
  }
  if (qrComplexity !== QR_COMPLEXITY_MAX) {
    return { key: 'transaction.preview.singleChunk' }
  }
  return { key: STATIC_QR_DESCRIPTION_KEYS[displayMode] }
}
