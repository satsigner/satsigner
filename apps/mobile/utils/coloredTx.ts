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

export class TransactionDecoded extends bitcoinjs.Transaction {
  constructor() {
    super()
  }

  static fromHex(hex: string): TransactionDecoded {
    const tx = super.fromHex(hex)
    Object.setPrototypeOf(tx, TransactionDecoded.prototype)
    return tx as TransactionDecoded
  }

  toAnnotatedData() {
    // witness transactions have a marker and flag
    if (this.hasWitnesses()) {
      return [
        ...this.getVersion(),
        ...this.getMarker(),
        ...this.getFlag(),
        ...this.getInputs(),
        ...this.getOutputs(),
        ...this.getWitnesses(),
        ...this.getLocktime()
      ]
    }
    // legacy transactions do not have a marker or flag
    return [
      ...this.getVersion(),
      ...this.getInputs(),
      ...this.getOutputs(),
      ...this.getLocktime()
    ]
  }

  getVersion() {
    const value = this.version
    const hex = toUInt32LE(value)
    return [hex, 'version', value,]
  }

  getMarker() {
    const value = TransactionDecoded.ADVANCED_TRANSACTION_MARKER
    const hex = toUInt8(value)
    return [hex, 'marker', value,]
  }

  getFlag() {
    const value = TransactionDecoded.ADVANCED_TRANSACTION_FLAG
    const hex = toUInt8(value)
    return [hex, 'flag', value,]
  }

  getInputs() {
    const inputTuples = this.ins.map((_, i) => [
      ...this.getInputHash(i),
      ...this.getInputIndex(i),
      ...this.getInputScriptVarInt(i),
      ...this.getInputScript(i),
      ...this.getInputSequence(i)
    ])

    return [...this.getInputCount(), ...inputTuples.flat()]
  }

  getInputCount() {
    const value = this.ins.length
    const hex = toVarInt(value)
    return [hex, 'txInVarInt', value,]
  }

  getInputHash(index: number) {
    const bigEndianHash = this.ins[index].hash
    const hex = bigEndianHash.toString('hex')
    const converted = Endian(bigEndianHash.toString('hex'))
    const label = `txIn[${index}]hash`
    return [hex, label, converted,]
  }

  getInputIndex(index: number) {
    const value = this.ins[index].index
    const hex = toUInt32LE(value)
    const label = `txIn[${index}]index`
    return [[hex, label, value,]]
  }

  getInputScriptVarInt(index: number) {
    const value = this.ins[index].script.length
    const hex = toVarInt(value)
    const label = `txIn[${index}]scriptVarInt`
    return [hex, label, value,]
  }

  getInputScript(index: number) {
    const value = this.ins[index].script
    const hex = value.toString('hex')
    let decoded
    if (hex === '') {
      decoded = 'Empty script'
    } else {
      decoded = bitcoinjs.script.toASM(value)
    }
    const label = `txIn[${index}]script`
    return [hex, label, decoded,]
  }

  getInputSequence(index: number) {
    const value = this.ins[index].sequence
    const hex = toUInt32LE(value)
    const label = `txIn[${index}]sequence`
    return [hex, label, value,]
  }

  getOutputs() {
    const outputTuples = this.outs.map((_, i) => [
      ...this.getOutputValue(i),
      ...this.getOutputScriptVarInt(i),
      ...this.getOutputScript(i)
    ])

    return [...this.getOutputCount(), ...outputTuples.flat()]
  }

  getOutputCount() {
    const value = this.outs.length
    const hex = toVarInt(value)
    return [hex, 'txOutVarInt', value,]
  }

  getOutputValue(index: number) {
    const value = this.outs[index].value
    const hex = toBigUInt64LE(value)
    const satsValue = `${value} sats`
    const label = `txOut[${index}]value`
    return [hex, label, satsValue,]
  }

  getOutputScriptVarInt(index: number) {
    const value = this.outs[index].script.length
    const hex = toVarInt(value)
    const label = `txOut[${index}]scriptVarInt`
    return [hex, label, value,]
  }

  getOutputScript(index: number) {
    const value = this.outs[index].script
    const hex = value.toString('hex')
    const decoded = bitcoinjs.script.toASM(value)
    const address = this.generateOutputScriptAddress(index)
    const label = `txOut[${index}]script`
    return [hex, label, decoded, address]
  }

  getWitnesses() {
    const witnessTuples = this.ins.map((_, i) => [
      ...this.getWitnessVarInt(i),
      ...this.getWitnessStackElements(i)
    ])

    return witnessTuples.flat()
  }

  getWitnessStackElements(index: number) {
    const witness = this.ins[index].witness
    const witnessTuples = witness.map((_, i) => [
      ...this.getWitnessItemsVarInt(index, i),
      ...this.getWitnessItem(index, i)
    ])

    return witnessTuples.flat()
  }

  getWitnessVarInt(index: number) {
    const value = this.ins[index].witness.length
    const hex = toVarInt(value)
    const label = `witness[${index}]VarInt`
    return [hex, label, value,]
  }

  getWitnessItemsVarInt(index: number, witnessIndex: number) {
    const value = this.ins[index].witness[witnessIndex].length
    const hex = toVarInt(value)
    const label = `witness[${index}][${witnessIndex}]scriptVarInt`
    return [hex, label, value,]
  }

  getWitnessItem(index: number, witnessIndex: number) {
    const witnessItem = this.ins[index].witness[witnessIndex]
    const hex = witnessItem.toString('hex')
    const w = this.identifyWitnessItem(witnessItem)
    const label = `witness[${index}][${witnessIndex}]script`
    return [hex, label, w.decoded, w.type]
  }

  getLocktime() {
    const value = this.locktime
    const hex = toUInt32LE(value)
    return [hex, 'locktime', value,]
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
