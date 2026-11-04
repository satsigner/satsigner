import { type PsbtLike } from 'react-native-bdk-sdk'

import { type QRDisplayMode } from '@/constants/qr'

export type MockPsbt = PsbtLike

export type PsbtBuildStatus = 'building' | 'error' | 'idle'

export type PsbtInputWithSignatures = {
  witnessScript?: Uint8Array
  partialSig?: {
    pubkey: Uint8Array
    signature: Uint8Array
  }[]
}

export type PsbtQrChunks = Record<QRDisplayMode, string[]>
