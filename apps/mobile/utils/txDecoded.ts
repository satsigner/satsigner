import ecc from '@bitcoinerlab/secp256k1'
import * as bitcoinjs from 'bitcoinjs-lib'
import varuint from 'varuint-bitcoin'

bitcoinjs.initEccLib(ecc)

export enum TxField {
  Version = 'version',
  Marker = 'marker',
  Flag = 'flag',
  TxInVarInt = 'txInVarInt',
  TxInHash = 'txInHash',
  TxInIndex = 'txInIndex',
  TxInScriptVarInt = 'txInScriptVarInt',
  TxInScript = 'txInScript',
  TxInSequence = 'txInSequence',
  TxOutVarInt = 'txOutVarInt',
  TxOutValue = 'txOutValue',
  TxOutScriptVarInt = 'txOutScriptVarInt',
  TxOutScript = 'txOutScript',
  WitnessVarInt = 'witnessVarInt',
  WitnessItemsVarInt = 'witnessItemsVarInt',
  WitnessItem = 'witnessItem',
  WitnessItemEmpty = 'witnessItemEmpty',
  WitnessItemPubkey = 'witnessItemPubkey',
  WitnessItemSignature = 'witnessItemSignature',
  WitnessItemScript = 'witnessItemScript',
  Locktime = 'locktime',
  TxOutScriptStandard = 'txOutScriptStandard',
  TxOutScriptNonStandard = 'txOutScriptNonStandard'
}

export type TxDecodedField = {
  hex: string
  field: TxField
  value: string | number
  placeholders?: Record<string, string | number>
}

export class TxDecoded extends bitcoinjs.Transaction {
  static fromHex(hex: string): TxDecoded {
    const tx = super.fromHex(hex)
    Object.setPrototypeOf(tx, TxDecoded.prototype)
    return tx as TxDecoded
  }

  static decodeFromHex(hex: string): TxDecodedField[] {
    return TxDecoded.fromHex(hex).decode()
  }

  decode(): TxDecodedField[] {
    // witness transactions have a marker and flag
    if (this.hasWitnesses()) {
      return [
        this.getVersion(),
        this.getMarker(),
        this.getFlag(),
        ...this.getInputs(),
        ...this.getOutputs(),
        ...this.getWitnesses(),
        this.getLocktime()
      ]
    }
    // legacy transactions do not have a marker or flag
    return [
      this.getVersion(),
      ...this.getInputs(),
      ...this.getOutputs(),
      this.getLocktime()
    ]
  }

  getVersion(): TxDecodedField {
    const value = this.version
    const hex = toUInt32LE(value)
    const field = TxField.Version
    return { hex, value, field }
  }

  getMarker(): TxDecodedField {
    const value = TxDecoded.ADVANCED_TRANSACTION_MARKER
    const hex = toUInt8(value)
    const field = TxField.Marker
    return { hex, value, field }
  }

  getFlag(): TxDecodedField {
    const value = TxDecoded.ADVANCED_TRANSACTION_FLAG
    const hex = toUInt8(value)
    const field = TxField.Flag
    return { hex, value, field }
  }

  getInputs(): TxDecodedField[] {
    const inputTuples = this.ins.map((_, i) => [
      this.getInputHash(i),
      this.getInputIndex(i),
      this.getInputScriptVarInt(i),
      this.getInputScript(i),
      this.getInputSequence(i)
    ])
    return [this.getInputCount(), ...inputTuples.flat()]
  }

  getInputCount(): TxDecodedField {
    const value = this.ins.length
    const hex = toVarInt(value)
    const field = TxField.TxInVarInt
    return { hex, value, field }
  }

  getInputHash(index: number): TxDecodedField {
    const bigEndianHash = this.ins[index].hash
    const hex = bigEndianHash.toString('hex')
    const value = Endian(bigEndianHash.toString('hex'))
    const field = TxField.TxInHash
    const placeholders = { input: index }
    return { hex, value, field, placeholders }
  }

  getInputIndex(index: number): TxDecodedField {
    const value = this.ins[index].index
    const hex = toUInt32LE(value)
    const field = TxField.TxInIndex
    const placeholders = { input: index }
    return { hex, value, field, placeholders }
  }

  getInputScriptVarInt(index: number): TxDecodedField {
    const value = this.ins[index].script.length
    const hex = toVarInt(value)
    const field = TxField.TxInScriptVarInt
    const placeholders = { input: index }
    return { hex, value, field, placeholders }
  }

  getInputScript(index: number): TxDecodedField {
    const script = this.ins[index].script
    const hex = script.toString('hex')
    let value
    if (hex === '') {
      value = ''
    } else {
      value = bitcoinjs.script.toASM(script)
    }
    const field = TxField.TxInScript
    const placeholders = { input: index }
    return { hex, value, field, placeholders }
  }

  getInputSequence(index: number): TxDecodedField {
    const value = this.ins[index].sequence
    const hex = toUInt32LE(value)
    const field = TxField.TxInSequence
    const placeholders = { input: index }
    return { hex, value, field, placeholders }
  }

  getOutputs(): TxDecodedField[] {
    const outputTuples = this.outs.map((_, i) => [
      this.getOutputValue(i),
      this.getOutputScriptVarInt(i),
      this.getOutputScript(i)
    ])
    return [this.getOutputCount(), ...outputTuples.flat()]
  }

  getOutputCount(): TxDecodedField {
    const value = this.outs.length
    const hex = toVarInt(value)
    const field = TxField.TxOutVarInt
    return { hex, value, field }
  }

  getOutputValue(index: number): TxDecodedField {
    const value = this.outs[index].value
    const hex = toBigUInt64LE(value)
    const field = TxField.TxOutValue
    const placeholders = { output: index }
    return { hex, value, field, placeholders }
  }

  getOutputScriptVarInt(index: number): TxDecodedField {
    const value = this.outs[index].script.length
    const hex = toVarInt(value)
    const field = TxField.TxOutScriptVarInt
    const placeholders = { output: index }
    return { hex, value, field, placeholders }
  }

  getOutputScript(index: number): TxDecodedField {
    const script = this.outs[index].script
    const hex = script.toString('hex')
    const value = bitcoinjs.script.toASM(script)
    const address = this.generateOutputScriptAddress(index)
    const field = address
      ? TxField.TxOutScriptStandard
      : TxField.TxOutScriptNonStandard
    const placeholders = { output: index, address }
    return { hex, value, field, placeholders }
  }

  getOutputsScripts(): TxDecodedField[] {
    return this.outs.map((_, i) => this.getOutputScript(i))
  }

  getWitnesses(): TxDecodedField[] {
    const witnessTuples = this.ins.map((_, i) => [
      this.getWitnessVarInt(i),
      ...this.getWitnessStackElements(i)
    ])
    return witnessTuples.flat()
  }

  getWitnessStackElements(index: number): TxDecodedField[] {
    const witness = this.ins[index].witness
    const witnessTuples = witness.map((_, i) => [
      this.getWitnessItemsVarInt(index, i),
      this.getWitnessItem(index, i)
    ])
    return witnessTuples.flat()
  }

  getWitnessVarInt(index: number): TxDecodedField {
    const value = this.ins[index].witness.length
    const hex = toVarInt(value)
    const field = TxField.WitnessVarInt
    const placeholders = { witness: index }
    return { hex, value, field, placeholders }
  }

  getWitnessItemsVarInt(index: number, witnessIndex: number): TxDecodedField {
    const value = this.ins[index].witness[witnessIndex].length
    const hex = toVarInt(value)
    const field = TxField.WitnessItemsVarInt
    const placeholders = { input: index, witness: witnessIndex }
    return { hex, field, value, placeholders }
  }

  getWitnessItem(index: number, witnessIndex: number): TxDecodedField {
    const witnessItem = this.ins[index].witness[witnessIndex]
    const hex = witnessItem.toString('hex')
    const { field, value } = this.identifyWitnessItem(witnessItem)
    const placeholders = { input: index, witness: witnessIndex }
    return { hex, field, value, placeholders }
  }

  getLocktime(): TxDecodedField {
    const value = this.locktime
    const hex = toUInt32LE(value)
    const field = TxField.Locktime
    return { hex, field, value }
  }

  generateOutputScriptAddress(
    index: number,
    network: bitcoinjs.Network = bitcoinjs.networks.testnet
  ) {
    try {
      const script = this.outs[index].script
      const address = bitcoinjs.address.fromOutputScript(script, network)
      return address
    } catch {
      return ''
    }
  }

  // identifyWitnessItem takes a witness item and returns a description of the item and a decoded value
  identifyWitnessItem(witnessItem: any) {
    const hex = witnessItem.toString('hex')
    if (hex === '') {
      return { field: TxField.WitnessItemEmpty, value: '' }
    }

    if (bitcoinjs.script.isCanonicalPubKey(witnessItem)) {
      return { field: TxField.WitnessItemPubkey, value: hex }
    }

    if (bitcoinjs.script.isCanonicalScriptSignature(witnessItem)) {
      return { field: TxField.WitnessItemSignature, value: hex }
    }

    // if the witness item is a script, decode it
    try {
      const decodedScript = bitcoinjs.script.toASM(witnessItem)
      return {
        field: TxField.WitnessItemScript,
        value: decodedScript
      }
    } catch {
      // not a script
    }

    // TODO: identify taproot witness items
    return { field: TxField.WitnessItem, value: hex }
  }
}

function toVarInt(value: number) {
  const varInt = varuint.encode(value)
  return varInt.toString('hex')
}

function toUInt8(value: number) {
  const buffer = Buffer.alloc(1)
  buffer.writeUInt8(value)
  return buffer.toString('hex')
}

function toUInt32LE(value: number) {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32LE(value)
  return buffer.toString('hex')
}

function toBigUInt64LE(value: number) {
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64LE(BigInt(value))
  return buffer.toString('hex')
}

function Endian(hexStr: string) {
  // Validate input
  if (hexStr.length % 2 !== 0) {
    throw new Error('Invalid hexadecimal string, length must be even.')
  }
  // Reverse the byte order
  let result = ''
  for (let i = hexStr.length - 2; i >= 0; i -= 2) {
    result += hexStr.substr(i, 2)
  }
  return result
}
