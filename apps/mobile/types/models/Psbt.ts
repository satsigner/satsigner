import { type PsbtLike } from 'react-native-bdk-sdk'

export type MockPsbt = PsbtLike

export type PsbtInputWithSignatures = {
  witnessScript?: Buffer
  partialSig?: {
    pubkey: Buffer
    signature: Buffer
  }[]
}
