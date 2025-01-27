import varuint from 'varuint-bitcoin'
import bitcoinjs from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'

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

const txDescriptions = {
  version:
    'This is a 4-byte little-endian integer, representing the transaction version',
  marker:
    "This is a one-byte marker (required to be '00') that serves as an indicator that the given transaction incorporates Segregated Witness (segwit) data.",
  flag: 'A one-byte flag that follows the marker in transactions with witness data. It must be non-zero. It can be interpreted as a bitvector, with the unused bits available for future extensibility for other types of witness data.',
  txInVarInt:
    'This is a variable integer (VarInt) that denotes the number of subsequent transaction inputs.',
  txInHash:
    'This is the hash of the transaction input. Note that the transaction hash here is in big-endian format, whereas in other places it is typically represented in little-endian format.',
  txInIndex:
    'This is a 4-byte little-endian integer which represents the index of the specific output in the previous transaction.',
  txInScriptVarInt:
    'This is a variable integer (VarInt) that denotes the length of the subsequent unlocking script.',
  txInScript:
    'This is the unlocking script (scriptSig), providing proof of ownership of the bitcoins being spent.',
  txInSequence:
    'This is a 4-byte little-endian number that specifies the relative locktime of the transaction input.',
  txOutVarInt:
    'This is a variable integer (VarInt) that denotes the number of subsequent transaction outputs.',
  txOutValue:
    'This is an 8-byte little-endian number that represents the amount of bitcoin to be sent in satoshis.',
  txOutScriptVarInt:
    'This is a variable integer (VarInt) that denotes the length (in bytes) of the subsequent locking script.',
  txOutScript:
    'This is the locking script (scriptPubKey), specifying the conditions under which the output can be spent.',
  witnessVarInt:
    'This is a variable integer (VarInt) that indicates the number of witness items for the transaction input. Note that each segwit input has its own witnessVarInt. The order of the witness items is the same as the order of the transaction inputs.',
  witnessItemsVarInt:
    'This is a variable integer (VarInt) that denotes the length (in bytes) of the subsequent witness item.',
  witnessItem: 'This is a witness item.',
  witnessItemEmpty: 'This witness item is empty.',
  witnessItemPubkey: 'This witness item is a public key.',
  witnessItemSignature: 'This witness item is a signature.',
  witnessItemScript: 'This witness item is a script.',
  locktime:
    'This is a 4-byte little-endian number that specifies the absolute locktime of the transaction.'
}

bitcoinjs.initEccLib(ecc)

export class ColoredTransaction extends bitcoinjs.Transaction {
  constructor() {
    super()
  }

  static fromHex(hex: string) {
    const tx = super.fromHex(hex)
    Object.setPrototypeOf(tx, ColoredTransaction.prototype)
    return tx
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
    return [[hex, 'version', value, txDescriptions.version]]
  }

  getMarker() {
    const value = ColoredTransaction.ADVANCED_TRANSACTION_MARKER
    const hex = toUInt8(value)
    return [[hex, 'marker', value, txDescriptions.marker]]
  }

  getFlag() {
    const value = ColoredTransaction.ADVANCED_TRANSACTION_FLAG
    const hex = toUInt8(value)
    return [[hex, 'flag', value, txDescriptions.flag]]
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
    return [[hex, 'txInVarInt', value, txDescriptions.txInVarInt]]
  }

  getInputHash(index: number) {
    const bigEndianHash = this.ins[index].hash
    const hex = bigEndianHash.toString('hex')
    const converted = Endian(bigEndianHash.toString('hex'))
    const label = `txIn[${index}]hash`
    return [[hex, label, converted, txDescriptions.txInHash]]
  }

  getInputIndex(index: number) {
    const value = this.ins[index].index
    const hex = toUInt32LE(value)
    const label = `txIn[${index}]index`
    return [[hex, label, value, txDescriptions.txInIndex]]
  }

  getInputScriptVarInt(index: number) {
    const value = this.ins[index].script.length
    const hex = toVarInt(value)
    const label = `txIn[${index}]scriptVarInt`
    return [[hex, label, value, txDescriptions.txInScriptVarInt]]
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
    return [[hex, label, decoded, txDescriptions.txInScript]]
  }

  getInputSequence(index: number) {
    const value = this.ins[index].sequence
    const hex = toUInt32LE(value)
    const label = `txIn[${index}]sequence`
    return [[hex, label, value, txDescriptions.txInSequence]]
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
    return [[hex, 'txOutVarInt', value, txDescriptions.txOutVarInt]]
  }

  getOutputValue(index: number) {
    const value = this.outs[index].value
    const hex = toBigUInt64LE(value)
    const satsValue = `${value} sats`
    const label = `txOut[${index}]value`
    return [[hex, label, satsValue, txDescriptions.txOutValue]]
  }

  getOutputScriptVarInt(index: number) {
    const value = this.outs[index].script.length
    const hex = toVarInt(value)
    const label = `txOut[${index}]scriptVarInt`
    return [[hex, label, value, txDescriptions.txOutScriptVarInt]]
  }

  getOutputScript(index: number) {
    const value = this.outs[index].script
    const hex = value.toString('hex')
    const decoded = bitcoinjs.script.toASM(value)
    const addressAndDescription =
      this.generateOutputScriptDescriptionWithAddress(index)
    const label = `txOut[${index}]script`
    return [[hex, label, decoded, addressAndDescription]]
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
    return [[hex, label, value, txDescriptions.witnessVarInt]]
  }

  getWitnessItemsVarInt(index: number, witnessIndex: number) {
    const value = this.ins[index].witness[witnessIndex].length
    const hex = toVarInt(value)
    const label = `witness[${index}][${witnessIndex}]scriptVarInt`
    return [[hex, label, value, txDescriptions.witnessItemsVarInt]]
  }

  getWitnessItem(index: number, witnessIndex: number) {
    const witnessItem = this.ins[index].witness[witnessIndex]
    const hex = witnessItem.toString('hex')
    const w = this.identifyWitnessItem(witnessItem)
    const label = `witness[${index}][${witnessIndex}]script`
    return [[hex, label, w.decoded, w.description]]
  }

  getLocktime() {
    const value = this.locktime
    const hex = toUInt32LE(value)
    return [[hex, 'locktime', value, txDescriptions.locktime]]
  }

  generateOutputScriptDescriptionWithAddress(index: number) {
    let description
    try {
      const script = this.outs[index].script
      const address = bitcoinjs.address.fromOutputScript(script)
      description = `${txDescriptions.txOutScript} This scriptPubkey is a standard type and can be encoded as the following address: ${address}`
    } catch (error) {
      description = `${txDescriptions.txOutScript} This scriptPubKey is non-standard and therefore cannot be encoded as an address.`
    }
    return description
  }

  // identifyWitnessItem takes a witness item and returns a description of the item and a decoded value
  identifyWitnessItem(witnessItem: any) {
    let hex = witnessItem.toString('hex')
    if (hex === '') {
      return { description: txDescriptions.witnessItemEmpty, decoded: '' }
    }

    if (bitcoinjs.script.isCanonicalPubKey(witnessItem)) {
      return { description: txDescriptions.witnessItemPubkey, decoded: hex }
    }

    if (bitcoinjs.script.isCanonicalScriptSignature(witnessItem)) {
      return { description: txDescriptions.witnessItemSignature, decoded: hex }
    }

    // if the witness item is a script, decode it
    try {
      const decodedScript = bitcoinjs.script.toASM(witnessItem)
      return {
        description: txDescriptions.witnessItemScript,
        decoded: decodedScript
      }
    } catch (error) {
      // not a script
    }

    // TODO: identify taproot witness items
    return { description: txDescriptions.witnessItem, decoded: hex }
  }
}
