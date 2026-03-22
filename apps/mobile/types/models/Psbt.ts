export interface MockPsbt {
  base64: string
  serialize: () => Promise<string>
  txid: () => Promise<string>
}

export interface MockTxBuilderResult {
  psbt: MockPsbt
  txDetails: {
    txid: string
    fee: number
  }
}

export interface PsbtInputWithSignatures {
  witnessScript?: Buffer
  partialSig?: {
    pubkey: Buffer
    signature: Buffer
  }[]
}
