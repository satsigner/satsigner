import { Buffer } from 'buffer'

const HTTP2_PREFACE = Buffer.from('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n')

const FRAME_HEADERS = 0x01
const FRAME_SETTINGS = 0x04
const FRAME_PING = 0x06
const FRAME_GOAWAY = 0x07
const FRAME_WINDOW_UPDATE = 0x08
const FRAME_DATA = 0x00
const FRAME_RST_STREAM = 0x03

const FLAG_END_STREAM = 0x01
const FLAG_ACK = 0x01
const FLAG_END_HEADERS = 0x04

const INDEXED_STATUS: Record<number, number> = {
  10: 206,
  11: 304,
  12: 400,
  13: 404,
  14: 500,
  8: 200,
  9: 204
}

export type Http2Frame = {
  flags: number
  payload: Buffer
  streamId: number
  type: number
}

function readU32BE(buf: Uint8Array, offset: number): number {
  return Math.trunc(
    (buf[offset] << 24) |
      (buf[offset + 1] << 16) |
      (buf[offset + 2] << 8) |
      buf[offset + 3]
  )
}

function writeU32BE(buf: Uint8Array, offset: number, value: number) {
  buf[offset] = (value >>> 24) & 0xff
  buf[offset + 1] = (value >>> 16) & 0xff
  buf[offset + 2] = (value >>> 8) & 0xff
  buf[offset + 3] = value & 0xff
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false
  }
  return Array.from(left).every((byte, index) => byte === right[index])
}

export function looksLikeHttp2Session(raw: Buffer): boolean {
  if (raw.length < 9) {
    return false
  }
  if (raw.length >= 24) {
    const prefix = raw.subarray(0, 24)
    if (bytesEqual(prefix, HTTP2_PREFACE.subarray(0, 24))) {
      return true
    }
  }
  const type = raw.at(3) ?? -1
  const streamId = readU32BE(raw, 5) & 0x7fffffff
  return (
    streamId === 0 &&
    (type === FRAME_SETTINGS ||
      type === FRAME_GOAWAY ||
      type === FRAME_WINDOW_UPDATE)
  )
}

export function buildHttp2PrefaceAndSettings(): Buffer {
  return Buffer.concat([
    HTTP2_PREFACE,
    http2Frame(FRAME_SETTINGS, 0, 0, Buffer.alloc(0))
  ])
}

export function buildHttp2HeadersEndStream(params: {
  authority: string
  macaroon: string
  method: string
  pathWithQuery: string
}): Buffer {
  const block = Buffer.concat([
    hpackLiteral(':method', params.method),
    hpackLiteral(':scheme', 'https'),
    hpackLiteral(':path', params.pathWithQuery),
    hpackLiteral(':authority', params.authority),
    hpackLiteral('grpc-metadata-macaroon', params.macaroon),
    hpackLiteral('content-type', 'application/json'),
    hpackLiteral('accept', 'application/json')
  ])
  return http2Frame(FRAME_HEADERS, FLAG_END_HEADERS | FLAG_END_STREAM, 1, block)
}

export function buildHttp2Post(params: {
  authority: string
  body: string
  macaroon: string
  method: string
  pathWithQuery: string
}): Buffer {
  const body = Buffer.from(params.body, 'utf8')
  const block = Buffer.concat([
    hpackLiteral(':method', params.method),
    hpackLiteral(':scheme', 'https'),
    hpackLiteral(':path', params.pathWithQuery),
    hpackLiteral(':authority', params.authority),
    hpackLiteral('grpc-metadata-macaroon', params.macaroon),
    hpackLiteral('content-type', 'application/json'),
    hpackLiteral('content-length', String(body.length))
  ])
  const headers = http2Frame(FRAME_HEADERS, FLAG_END_HEADERS, 1, block)
  const data = http2Frame(FRAME_DATA, FLAG_END_STREAM, 1, body)
  return Buffer.concat([headers, data])
}

export function http2SettingsAck(): Buffer {
  return http2Frame(FRAME_SETTINGS, FLAG_ACK, 0, Buffer.alloc(0))
}

export function http2PingAck(payload: Buffer): Buffer {
  return http2Frame(FRAME_PING, FLAG_ACK, 0, payload)
}

export function takeHttp2Frames(raw: Buffer): {
  frames: Http2Frame[]
  rest: Buffer
} {
  const frames: Http2Frame[] = []
  if (raw.length < 9) {
    return { frames, rest: raw }
  }
  const length = (raw[0] << 16) | (raw[1] << 8) | raw[2]
  const total = 9 + length
  if (raw.length < total) {
    return { frames, rest: raw }
  }
  const frame: Http2Frame = {
    flags: raw[4],
    payload: Buffer.from(raw.subarray(9, total)),
    streamId: readU32BE(raw, 5) & 0x7fffffff,
    type: raw[3]
  }
  const next = takeHttp2Frames(Buffer.from(raw.subarray(total)))
  return { frames: [frame, ...next.frames], rest: next.rest }
}

export function statusFromHpackHeaders(payload: Buffer): number | null {
  return readHpackStatus(payload, 0)
}

export function isGoawayFrame(frame: Http2Frame): boolean {
  return frame.type === FRAME_GOAWAY
}

export function isRstStreamFrame(frame: Http2Frame): boolean {
  return frame.type === FRAME_RST_STREAM
}

function http2Frame(
  type: number,
  flags: number,
  streamId: number,
  payload: Buffer
): Buffer {
  const header = Buffer.alloc(9)
  const { length } = payload
  header[0] = (length >> 16) & 0xff
  header[1] = (length >> 8) & 0xff
  header[2] = length & 0xff
  header[3] = type
  header[4] = flags
  writeU32BE(header, 5, streamId & 0x7fffffff)
  return Buffer.concat([header, payload])
}

function hpackLiteral(name: string, value: string): Buffer {
  return Buffer.concat([
    Buffer.from([0x00]),
    hpackString(name),
    hpackString(value)
  ])
}

function hpackString(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8')
  return Buffer.concat([encodeHpackInt(bytes.length, 7, 0), bytes])
}

function encodeHpackInt(
  value: number,
  prefixBits: number,
  firstByteBits: number
): Buffer {
  const max = (1 << prefixBits) - 1
  if (value < max) {
    return Buffer.from([firstByteBits | value])
  }
  return Buffer.from([firstByteBits | max, ...encodeHpackIntTail(value - max)])
}

function encodeHpackIntTail(value: number): number[] {
  if (value < 128) {
    return [value]
  }
  return [(value % 128) + 128, ...encodeHpackIntTail(Math.floor(value / 128))]
}

function readHpackStatus(payload: Buffer, offset: number): number | null {
  if (offset >= payload.length) {
    return null
  }
  const byte = payload[offset]
  if ((byte & 0x80) === 0x80) {
    const index = byte & 0x7f
    const indexed = INDEXED_STATUS[index]
    if (indexed !== undefined) {
      return indexed
    }
    return readHpackStatus(payload, offset + 1)
  }
  if ((byte & 0xe0) === 0x20) {
    const consumed = hpackIntLength(payload, offset, 5)
    return readHpackStatus(payload, offset + consumed)
  }
  const namePrefix = (byte & 0xc0) === 0x40 ? 6 : 4
  const { index, next } = decodeHpackInt(payload, offset, namePrefix)
  if (index > 0) {
    const value = decodeHpackString(payload, next)
    if (!value) {
      return null
    }
    if (index === 8) {
      const status = Number(value.text)
      if (Number.isFinite(status)) {
        return status
      }
    }
    return readHpackStatus(payload, value.next)
  }
  const name = decodeHpackString(payload, next)
  if (!name) {
    return null
  }
  const value = decodeHpackString(payload, name.next)
  if (!value) {
    return null
  }
  if (name.text === ':status') {
    const status = Number(value.text)
    return Number.isFinite(status) ? status : null
  }
  return readHpackStatus(payload, value.next)
}

function hpackIntLength(
  payload: Buffer,
  offset: number,
  prefixBits: number
): number {
  return decodeHpackInt(payload, offset, prefixBits).next - offset
}

function decodeHpackInt(
  payload: Buffer,
  offset: number,
  prefixBits: number
): { index: number; next: number } {
  const max = (1 << prefixBits) - 1
  const first = payload[offset] & max
  if (first < max) {
    return { index: first, next: offset + 1 }
  }
  return decodeHpackIntTail(payload, offset + 1, max, 0)
}

function decodeHpackIntTail(
  payload: Buffer,
  offset: number,
  value: number,
  shift: number
): { index: number; next: number } {
  if (offset >= payload.length) {
    return { index: value, next: offset }
  }
  const byte = payload[offset]
  const nextValue = value + ((byte & 0x7f) << shift)
  if ((byte & 0x80) === 0) {
    return { index: nextValue, next: offset + 1 }
  }
  return decodeHpackIntTail(payload, offset + 1, nextValue, shift + 7)
}

function decodeHpackString(
  payload: Buffer,
  offset: number
): { next: number; text: string } | null {
  if (offset >= payload.length) {
    return null
  }
  const huffman = (payload[offset] & 0x80) === 0x80
  const { index: length, next } = decodeHpackInt(payload, offset, 7)
  if (next + length > payload.length) {
    return null
  }
  const bytes = payload.subarray(next, next + length)
  if (huffman) {
    return null
  }
  return { next: next + length, text: Buffer.from(bytes).toString('utf8') }
}
