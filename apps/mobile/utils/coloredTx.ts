import varuint from 'varuint-bitcoin'
import * as bitcoinjs from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'

bitcoinjs.initEccLib(ecc)

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
  // WARNING:: 64 bits not working ...
  // buffer.writeBigUInt64LE(BigInt(value))
  buffer.writeUInt32LE((value))
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

export type TxDecodedField = {
  hex: string
  label: string
  value: string | number
  other?: string
}

export class TxDecoded extends bitcoinjs.Transaction {
  constructor() {
    super()
  }

  static fromHex(hex: string): TxDecoded {
    const tx = super.fromHex(hex)
    Object.setPrototypeOf(tx, TxDecoded.prototype)
    return tx as TxDecoded
  }

  toAnnotatedData() {
    // witness transactions have a marker and flag
    if (this.hasWitnesses()) {
      return {
        version: this.getVersion(),
        marker: this.getMarker(),
        flag: this.getFlag(),
        inputs: this.getInputs(),
        outputs: this.getOutputs(),
        witnesseses: this.getWitnesses(),
        lockTime: this.getLocktime()
      }
    }
    // legacy transactions do not have a marker or flag
    return {
      version: this.getVersion(),
      inputs: this.getInputs(),
      outputs: this.getOutputs(),
      lockTime: this.getLocktime()
    }
  }

  getVersion(): TxDecodedField {
    const value = this.version
    const hex = toUInt32LE(value)
    const label = 'version'
    return { hex, label, value }
  }

  getMarker(): TxDecodedField {
    const value = TxDecoded.ADVANCED_TRANSACTION_MARKER
    const hex = toUInt8(value)
    const label = 'marker'
    return { hex, label, value }
  }

  getFlag(): TxDecodedField {
    const value = TxDecoded.ADVANCED_TRANSACTION_FLAG
    const hex = toUInt8(value)
    const label = 'flag'
    return { hex, label, value }
  }

  getInputs() {
    const inputTuples = this.ins.map((_, i) => [
      this.getInputHash(i),
      this.getInputIndex(i),
      this.getInputScriptVarInt(i),
      this.getInputScript(i),
      this.getInputSequence(i)
    ])
    return {
      count: this.getInputCount(),
      items: inputTuples.flat(),
    }
  }

  getInputCount(): TxDecodedField {
    const value = this.ins.length
    const hex = toVarInt(value)
    const label = 'txInVarInt'
    return { hex, label, value }
  }

  getInputHash(index: number): TxDecodedField {
    const bigEndianHash = this.ins[index].hash
    const hex = bigEndianHash.toString('hex')
    const value = Endian(bigEndianHash.toString('hex'))
    const label = `txIn[${index}]hash`
    return { hex, label, value }
  }

  getInputIndex(index: number): TxDecodedField {
    const value = this.ins[index].index
    const hex = toUInt32LE(value)
    const label = `txIn[${index}]index`
    return { hex, label, value }
  }

  getInputScriptVarInt(index: number): TxDecodedField {
    const value = this.ins[index].script.length
    const hex = toVarInt(value)
    const label = `txIn[${index}]scriptVarInt`
    return { hex, label, value }
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
    const label = `txIn[${index}]script`
    return { hex, label, value }
  }

  getInputSequence(index: number): TxDecodedField {
    const value = this.ins[index].sequence
    const hex = toUInt32LE(value)
    const label = `txIn[${index}]sequence`
    return { hex, label, value }
  }

  getOutputs() {
    const outputTuples = this.outs.map((_, i) => [
      this.getOutputValue(i),
      this.getOutputScriptVarInt(i),
      this.getOutputScript(i)
    ])
    return {
      count: this.getOutputCount(),
      items: outputTuples.flat(),
    }
  }

  getOutputCount(): TxDecodedField {
    const value = this.outs.length
    const hex = toVarInt(value)
    const label = 'txOutVarInt';
    return { hex, label, value }
  }

  getOutputValue(index: number): TxDecodedField {
    const value = this.outs[index].value
    const hex = toBigUInt64LE(value)
    const label = `txOut[${index}]value`
    return { hex, label, value }
  }

  getOutputScriptVarInt(index: number): TxDecodedField {
    const value = this.outs[index].script.length
    const hex = toVarInt(value)
    const label = `txOut[${index}]scriptVarInt`
    return { hex, label, value }
  }

  getOutputScript(index: number): TxDecodedField {
    const script = this.outs[index].script
    const hex = script.toString('hex')
    const value = bitcoinjs.script.toASM(script)
    const address = this.generateOutputScriptAddress(index)
    const label = `txOut[${index}]script`
    return { hex, label, value, other: address}
  }

  getWitnesses() {
    const witnessTuples = this.ins.map((_, i) => [
      this.getWitnessVarInt(i),
      this.getWitnessStackElements(i)
    ])
    return witnessTuples.flat()
  }

  getWitnessStackElements(index: number) {
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
    const label = `witness[${index}]VarInt`
    return { hex, label, value }
  }

  getWitnessItemsVarInt(index: number, witnessIndex: number): TxDecodedField {
    const value = this.ins[index].witness[witnessIndex].length
    const hex = toVarInt(value)
    const label = `witness[${index}][${witnessIndex}]scriptVarInt`
    return { hex, label, value }
  }

  getWitnessItem(index: number, witnessIndex: number): TxDecodedField {
    const witnessItem = this.ins[index].witness[witnessIndex]
    const hex = witnessItem.toString('hex')
    const w = this.identifyWitnessItem(witnessItem)
    const label = `witness[${index}][${witnessIndex}]script`
    return { hex, label, value: w.decoded, other: w.type}
  }

  getLocktime(): TxDecodedField {
    const value = this.locktime
    const hex = toUInt32LE(value)
    const label = 'locktime';
    return { hex, label, value }
  }

  generateOutputScriptAddress(index: number) {
    try {
      const script = this.outs[index].script
      const address = bitcoinjs.address.fromOutputScript(script)
      return address
    } catch {
      return ''
    }
  }

  // identifyWitnessItem takes a witness item and returns a description of the item and a decoded value
  identifyWitnessItem(witnessItem: any) {
    let hex = witnessItem.toString('hex')
    if (hex === '') {
      return { type: 'witnessItemEmpty', decoded: '' }
    }

    if (bitcoinjs.script.isCanonicalPubKey(witnessItem)) {
      return { type: 'witnessItemPubkey', decoded: hex }
    }

    if (bitcoinjs.script.isCanonicalScriptSignature(witnessItem)) {
      return { type: 'witnessItemSignature', decoded: hex }
    }

    // if the witness item is a script, decode it
    try {
      const decodedScript = bitcoinjs.script.toASM(witnessItem)
      return {
        type: 'witnessItemScript',
        decoded: decodedScript
      }
    } catch {
      // not a script
    }

    // TODO: identify taproot witness items
    return { type: 'witnessItem', decoded: hex }
  }
}
