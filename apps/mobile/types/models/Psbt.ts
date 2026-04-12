export type MockPsbt = {
  toBase64: () => string
  txid: () => string
  feeAmount: () => number | undefined
  extractTxHex: () => string
}

export type PsbtInputWithSignatures = {
  witnessScript?: Buffer
  partialSig?: {
    pubkey: Buffer
    signature: Buffer
  }[]
}
