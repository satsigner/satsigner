// Encoding formats offered when exporting data as (animated) QR codes.
export enum QRDisplayMode {
  RAW = 'RAW',
  UR = 'UR',
  BBQR = 'BBQR'
}

// Largest payload (chars/bytes) a single QR can hold before we must chunk it.
export const QR_MAX_DATA_SIZE = 1500
// Characters shown in the on-screen QR text preview before truncating.
export const QR_VALUE_PREVIEW_LENGTH = 100

// QR "density" scale exposed to the user. Max = single static (unchunked) QR.
export const QR_COMPLEXITY_MIN = 1
export const QR_COMPLEXITY_MAX = 12
export const QR_COMPLEXITY_DEFAULT = 8

// Animation speed scale for cycling multi-part QR frames.
export const ANIMATION_SPEED_MIN = 1
export const ANIMATION_SPEED_MAX = 12
export const ANIMATION_SPEED_DEFAULT = 6
export const ANIMATION_INTERVAL_MAX_MS = 2000 // slowest cycle (speed = min)
export const ANIMATION_INTERVAL_MIN_MS = 200 // fastest cycle (speed = max)
export const ANIMATION_INTERVAL_FLOOR_MS = 100 // hard per-frame lower bound

// Chunk/fragment sizing for the three export encodings.
export const RAW_CHUNK_BASE_SIZE = 100
export const RAW_CHUNK_MAX_MULTIPLIER = 8
export const BBQR_CHUNK_BASE_SIZE = 30
export const BBQR_CHUNK_MIN_SIZE = 100
export const BBQR_SINGLE_CHUNK_MULTIPLIER = 10
export const UR_FRAGMENT_BASE_SIZE = 15
export const UR_FRAGMENT_MIN_SIZE = 50
export const QR_ENCODING_OVERHEAD = 1.5 // BBQR/UR add ~50% over the raw payload
