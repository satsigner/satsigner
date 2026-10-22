import { type PsbtLike } from 'react-native-bdk-sdk'

import { type QRDisplayMode } from '@/constants/qr'

export type MockPsbt = PsbtLike

export type PsbtBuildStatus = 'building' | 'error' | 'idle'

export type PsbtInputWithSignatures = {
  witnessScript?: Buffer
  partialSig?: {
    pubkey: Buffer
    signature: Buffer
  }[]
}

export type PsbtQrChunks = Record<QRDisplayMode, string[]>
