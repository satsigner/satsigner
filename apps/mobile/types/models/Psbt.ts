export type MockPsbt = {
  base64: string
  serialize: () => Promise<string>
  txid: () => Promise<string>
}

export type MockTxBuilderResult = {
  psbt: MockPsbt
  txDetails: {
    txid: string
    fee: number
  }
}

export type PsbtInputWithSignatures = {
  witnessScript?: Buffer
  partialSig?: {
    pubkey: Buffer
    signature: Buffer
  }[]
}
