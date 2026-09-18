import { HDKey } from '@scure/bip32'

const TAG_HDKEY = 303
const TAG_KEYPATH = 304
const TAG_COIN_INFO = 305
const TAG_ECKEY = 306
const TAG_ADDRESS = 307
const TAG_CRYPTO_OUTPUT = 308
const TAG_SCRIPT_HASH = 400
const TAG_WITNESS_SCRIPT_HASH = 401
const TAG_PUBLIC_KEY = 402
const TAG_PUBLIC_KEY_HASH = 403
const TAG_WITNESS_PUBLIC_KEY_HASH = 404
const TAG_COMBO = 405
const TAG_MULTISIG = 406
const TAG_SORTED_MULTISIG = 407
const TAG_RAW = 408
const TAG_TAPROOT = 409
const TAG_COSIGNER = 410
const TAG_OUTPUT_DESCRIPTOR_V3 = 40308

const MAINNET_VERSIONS = { private: 0x0488ade4, public: 0x0488b21e }
const TESTNET_VERSIONS = { private: 0x04358394, public: 0x043587cf }

type CborMap = Map<CborValue, CborValue>

type CborTag = {
  tag: number
  value: CborValue
}

type CborValue =
  | boolean
  | CborMap
  | CborTag
  | CborValue[]
  | null
  | number
  | string
  | Uint8Array

type Cursor = {
  bytes: Uint8Array
  offset: number
}

function isCborMap(value: CborValue): value is CborMap {
  return value instanceof Map
}

function isCborTag(value: CborValue): value is CborTag {
  return Boolean(value && typeof value === 'object' && 'tag' in value)
}

function unwrap(value: CborValue): CborValue {
  if (isCborTag(value)) {
    return unwrap(value.value)
  }
  return value
}

function readByte(cursor: Cursor) {
  const byte = cursor.bytes[cursor.offset]
  if (byte === undefined) {
    throw new Error('Unexpected end of CBOR')
  }
  cursor.offset += 1
  return byte
}

function readBytes(cursor: Cursor, length: number) {
  const start = cursor.offset
  const end = start + length
  if (end > cursor.bytes.length) {
    throw new Error('Unexpected end of CBOR')
  }
  cursor.offset = end
  return cursor.bytes.slice(start, end)
}

function readUint32(bytes: Uint8Array, offset = 0) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0)
}

function readUint(cursor: Cursor, additional: number) {
  if (additional < 24) {
    return additional
  }
  if (additional === 24) {
    return readByte(cursor)
  }
  if (additional === 25) {
    const bytes = readBytes(cursor, 2)
    return (bytes[0] << 8) | bytes[1]
  }
  if (additional === 26) {
    return readUint32(readBytes(cursor, 4))
  }
  if (additional === 27) {
    const bytes = readBytes(cursor, 8)
    const high = readUint32(bytes, 0)
    const low = readUint32(bytes, 4)
    if (high === 0) {
      return low
    }
    return high * 0x1_0000_0000 + low
  }
  throw new Error('Unsupported CBOR integer')
}

function decodeCborValue(cursor: Cursor): CborValue {
  const initial = readByte(cursor)
  const major = initial >> 5
  const additional = initial & 0x1f

  if (major === 0) {
    return readUint(cursor, additional)
  }
  if (major === 1) {
    return -1 - readUint(cursor, additional)
  }
  if (major === 2) {
    return readBytes(cursor, readUint(cursor, additional))
  }
  if (major === 3) {
    return Buffer.from(
      readBytes(cursor, readUint(cursor, additional))
    ).toString('utf8')
  }
  if (major === 4) {
    const length = readUint(cursor, additional)
    const items: CborValue[] = []
    for (let index = 0; index < length; index += 1) {
      items.push(decodeCborValue(cursor))
    }
    return items
  }
  if (major === 5) {
    const length = readUint(cursor, additional)
    const map: CborMap = new Map()
    for (let index = 0; index < length; index += 1) {
      const key = unwrap(decodeCborValue(cursor))
      const value = decodeCborValue(cursor)
      map.set(key, value)
    }
    return map
  }
  if (major === 6) {
    const tag = readUint(cursor, additional)
    return { tag, value: decodeCborValue(cursor) }
  }
  if (additional === 20) {
    return false
  }
  if (additional === 21) {
    return true
  }
  if (additional === 22) {
    return null
  }
  throw new Error('Unsupported CBOR value')
}

function decodeCbor(bytes: Uint8Array): CborValue {
  return decodeCborValue({ bytes, offset: 0 })
}

function mapGet(map: CborMap, key: number): CborValue | undefined {
  return map.get(key)
}

function asMap(value: CborValue | undefined): CborMap | null {
  if (!value) {
    return null
  }
  const unwrapped = unwrap(value)
  if (isCborMap(unwrapped)) {
    return unwrapped
  }
  return null
}

function asArray(value: CborValue | undefined): CborValue[] | null {
  if (!value) {
    return null
  }
  const unwrapped = unwrap(value)
  if (Array.isArray(unwrapped)) {
    return unwrapped
  }
  return null
}

function asNumber(value: CborValue | undefined) {
  if (typeof value === 'number') {
    return value
  }
  return undefined
}

function asBytes(value: CborValue | undefined) {
  const unwrapped = value ? unwrap(value) : undefined
  if (unwrapped instanceof Uint8Array) {
    return unwrapped
  }
  return undefined
}

function asString(value: CborValue | undefined) {
  const unwrapped = value ? unwrap(value) : undefined
  if (typeof unwrapped === 'string') {
    return unwrapped
  }
  return undefined
}

function fingerprintHex(value: number) {
  return value.toString(16).padStart(8, '0')
}

function formatPathComponent(index: number, hardened: boolean) {
  return hardened ? `${index}'` : `${index}`
}

function parsePathComponents(items: CborValue[]): string {
  const parts: string[] = []
  let index = 0
  while (index < items.length) {
    const item = items[index]
    if (Array.isArray(item) && item.length === 0) {
      const hardened = items[index + 1] === true
      parts.push(hardened ? "*'" : '*')
      index += 2
      continue
    }
    if (
      Array.isArray(item) &&
      item.length === 2 &&
      typeof item[0] === 'number' &&
      typeof item[1] === 'number'
    ) {
      const hardened = items[index + 1] === true
      parts.push(
        `${formatPathComponent(item[0], hardened)}-${formatPathComponent(item[1], hardened)}`
      )
      index += 2
      continue
    }
    if (
      Array.isArray(item) &&
      item.length === 2 &&
      Array.isArray(item[0]) &&
      Array.isArray(item[1])
    ) {
      const [external, internal] = item
      const externalIndex = asNumber(unwrap(external[0]))
      const internalIndex = asNumber(unwrap(internal[0]))
      if (externalIndex !== undefined && internalIndex !== undefined) {
        parts.push(`<${externalIndex};${internalIndex}>`)
      }
      index += 1
      continue
    }
    if (typeof item === 'number') {
      const hardened = items[index + 1] === true
      parts.push(formatPathComponent(item, hardened))
      index += 2
      continue
    }
    index += 1
  }
  return parts.join('/')
}

function keypathFromValue(value: CborValue | undefined) {
  const map = asMap(value)
  if (!map) {
    return null
  }
  const components = asArray(mapGet(map, 1)) ?? []
  const path = parsePathComponents(components)
  const fingerprint = asNumber(mapGet(map, 2))
  const depth = asNumber(mapGet(map, 3))
  const last = components.at(-2)
  const lastHardened = components.at(-1) === true
  const lastIndex =
    typeof last === 'number' ? (lastHardened ? last + 0x80000000 : last) : 0
  return {
    depth: depth ?? Math.floor(components.length / 2),
    fingerprint,
    lastIndex,
    path
  }
}

function isTestnetCoinInfo(value: CborValue | undefined) {
  const map = asMap(value)
  if (!map) {
    return false
  }
  return asNumber(mapGet(map, 2)) === 1
}

function encodeExtendedKey(hdkey: CborMap) {
  const isMaster = mapGet(hdkey, 1) === true
  const isPrivate = mapGet(hdkey, 2) === true
  const keyData = asBytes(mapGet(hdkey, 3))
  const chainCode = asBytes(mapGet(hdkey, 4))
  if (!keyData || !chainCode) {
    if (keyData) {
      return Buffer.from(keyData).toString('hex')
    }
    return null
  }

  const origin = keypathFromValue(mapGet(hdkey, 6))
  const children = keypathFromValue(mapGet(hdkey, 7))
  const parentFingerprint = asNumber(mapGet(hdkey, 8)) ?? 0
  const testnet = isTestnetCoinInfo(mapGet(hdkey, 5))
  const versions = testnet ? TESTNET_VERSIONS : MAINNET_VERSIONS

  const hd = new HDKey({
    chainCode,
    depth: isMaster ? 0 : (origin?.depth ?? 0),
    index: isMaster ? 0 : (origin?.lastIndex ?? 0),
    parentFingerprint: isMaster ? 0 : parentFingerprint,
    privateKey: isPrivate ? keyData.slice(1) : undefined,
    publicKey: isPrivate ? undefined : keyData,
    versions
  })

  const extended = isPrivate ? hd.privateExtendedKey : hd.publicExtendedKey
  const originPrefix =
    origin?.fingerprint && origin.path
      ? `[${fingerprintHex(origin.fingerprint)}/${origin.path}]`
      : origin?.fingerprint
        ? `[${fingerprintHex(origin.fingerprint)}]`
        : ''
  const childrenSuffix = children?.path ? `/${children.path}` : ''
  return `${originPrefix}${extended}${childrenSuffix}`
}

function encodeEcKey(eckey: CborMap) {
  const data = asBytes(mapGet(eckey, 3))
  if (!data) {
    return null
  }
  return Buffer.from(data).toString('hex')
}

function encodeKeyExp(value: CborValue): string | null {
  if (!isCborTag(value)) {
    const map = asMap(value)
    if (map?.has(3) && map?.has(4)) {
      return encodeExtendedKey(map)
    }
    if (map?.has(3)) {
      return encodeEcKey(map)
    }
    return null
  }
  if (value.tag === TAG_HDKEY) {
    const map = asMap(value.value)
    return map ? encodeExtendedKey(map) : null
  }
  if (value.tag === TAG_ECKEY) {
    const map = asMap(value.value)
    return map ? encodeEcKey(map) : null
  }
  return encodeKeyExp(unwrap(value))
}

function encodeMultisig(value: CborValue, fnName: string) {
  const map = asMap(value)
  if (!map) {
    return null
  }
  const threshold = asNumber(mapGet(map, 1))
  const keys = asArray(mapGet(map, 2))
  if (threshold === undefined || !keys) {
    return null
  }
  const encodedKeys = keys.map((key) => encodeKeyExp(key)).filter(Boolean)
  if (encodedKeys.length !== keys.length) {
    return null
  }
  return `${fnName}(${threshold},${encodedKeys.join(',')})`
}

function encodeScriptExp(value: CborValue): string | null {
  if (!isCborTag(value)) {
    return encodeKeyExp(value)
  }

  if (value.tag === TAG_CRYPTO_OUTPUT) {
    return encodeScriptExp(value.value)
  }
  if (value.tag === TAG_OUTPUT_DESCRIPTOR_V3) {
    const map = asMap(value.value)
    return map ? (asString(mapGet(map, 1)) ?? null) : null
  }
  if (value.tag === TAG_SCRIPT_HASH) {
    const inner = encodeScriptExp(value.value)
    return inner ? `sh(${inner})` : null
  }
  if (value.tag === TAG_WITNESS_SCRIPT_HASH) {
    const inner = encodeScriptExp(value.value)
    return inner ? `wsh(${inner})` : null
  }
  if (value.tag === TAG_PUBLIC_KEY) {
    const inner = encodeKeyExp(value.value)
    return inner ? `pk(${inner})` : null
  }
  if (value.tag === TAG_PUBLIC_KEY_HASH) {
    const inner = encodeKeyExp(value.value)
    return inner ? `pkh(${inner})` : null
  }
  if (value.tag === TAG_WITNESS_PUBLIC_KEY_HASH) {
    const inner = encodeKeyExp(value.value)
    return inner ? `wpkh(${inner})` : null
  }
  if (value.tag === TAG_COMBO) {
    const inner = encodeKeyExp(value.value)
    return inner ? `combo(${inner})` : null
  }
  if (value.tag === TAG_MULTISIG) {
    return encodeMultisig(value.value, 'multi')
  }
  if (value.tag === TAG_SORTED_MULTISIG) {
    return encodeMultisig(value.value, 'sortedmulti')
  }
  if (value.tag === TAG_TAPROOT) {
    const inner = encodeScriptExp(value.value)
    return inner ? `tr(${inner})` : null
  }
  if (value.tag === TAG_COSIGNER) {
    const inner = encodeKeyExp(value.value)
    return inner ? `cosigner(${inner})` : null
  }
  if (value.tag === TAG_RAW) {
    const bytes = asBytes(value.value)
    return bytes ? `raw(${Buffer.from(bytes).toString('hex')})` : null
  }
  if (value.tag === TAG_ADDRESS) {
    return encodeKeyExp(value)
  }
  if (value.tag === TAG_HDKEY || value.tag === TAG_ECKEY) {
    return encodeKeyExp(value)
  }
  if (value.tag === TAG_KEYPATH || value.tag === TAG_COIN_INFO) {
    return null
  }
  return encodeScriptExp(value.value)
}

export function looksLikeCryptoOutputCbor(bytes: Uint8Array) {
  if (bytes.length < 3 || bytes[0] !== 0xd9) {
    return false
  }
  const tag = (bytes[1] << 8) | bytes[2]
  return (
    tag === TAG_CRYPTO_OUTPUT ||
    tag === TAG_OUTPUT_DESCRIPTOR_V3 ||
    (tag >= TAG_SCRIPT_HASH && tag <= TAG_COSIGNER)
  )
}

export function decodeCryptoOutputCbor(bytes: Uint8Array): string | null {
  try {
    const decoded = decodeCbor(bytes)
    return encodeScriptExp(decoded)
  } catch {
    return null
  }
}
