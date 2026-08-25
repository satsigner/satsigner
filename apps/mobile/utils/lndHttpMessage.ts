import { Buffer } from 'buffer'

const HEADER_SEPARATOR_CRLF = Buffer.from('\r\n\r\n')
const HEADER_SEPARATOR_LF = Buffer.from('\n\n')
const CRLF = Buffer.from('\r\n')
const LF = Buffer.from('\n')

function asBuffer(view: Uint8Array): Buffer {
  return Buffer.isBuffer(view) ? view : Buffer.from(view)
}

function indexOfBytes(
  haystack: Uint8Array,
  needle: Uint8Array,
  from = 0
): number {
  const lastStart = haystack.length - needle.length
  if (needle.length === 0 || lastStart < from) {
    return needle.length === 0 ? from : -1
  }
  const startIndexes = Array.from(
    { length: lastStart - from + 1 },
    (_, i) => i + from
  )
  const found = startIndexes.find((start) =>
    Array.from(needle).every((byte, j) => haystack[start + j] === byte)
  )
  return found ?? -1
}

export function startsWithHttp1Response(raw: Buffer): boolean {
  const start = skipLeadingNoise(raw)
  if (start >= raw.length) {
    return false
  }
  const signature = asBuffer(
    raw.subarray(start, Math.min(raw.length, start + 8))
  )
    .toString('ascii')
    .toUpperCase()
  return signature.startsWith('HTTP/')
}

function skipLeadingNoise(raw: Buffer): number {
  if (raw.length === 0) {
    return 0
  }
  if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
    return 3
  }
  if (raw[0] === 0x20 || raw[0] === 0x09 || raw[0] === 0x0d || raw[0] === 0x0a) {
    return 1 + skipLeadingNoise(asBuffer(raw.subarray(1)))
  }
  return 0
}

export function buildLndHttp1Request(params: {
  body: string
  headers: Record<string, string>
  hostHeader: string
  macaroon: string
  method: string
  pathWithQuery: string
}): string {
  const { body, headers, hostHeader, macaroon, method, pathWithQuery } = params
  const headerMap: Record<string, string> = {
    Connection: 'close',
    'Content-Type': 'application/json',
    'Grpc-Metadata-macaroon': macaroon,
    Host: hostHeader,
    ...headers
  }
  if (body.length > 0 || !['GET', 'HEAD'].includes(method)) {
    headerMap['Content-Length'] = String(Buffer.byteLength(body))
  }

  const headerLines = Object.entries(headerMap).map(
    ([key, value]) => `${key}: ${value}`
  )
  return `${method} ${pathWithQuery} HTTP/1.1\r\n${headerLines.join('\r\n')}\r\n\r\n${body}`
}

export function tryParseHttp1Response(
  raw: Buffer,
  ended = false
): { body: Buffer; status: number } | null {
  if (!startsWithHttp1Response(raw)) {
    return null
  }
  const start = skipLeadingNoise(raw)
  const view = asBuffer(raw.subarray(start))
  const sep = findHeaderSeparator(view)
  if (!sep) {
    if (ended) {
      throwInvalidHttp1(view)
    }
    return null
  }
  const headerText = asBuffer(view.subarray(0, sep.index))
    .toString('latin1')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
  const rest = asBuffer(view.subarray(sep.index + sep.length))
  const lines = headerText.split('\n')
  const statusLine = lines[0] ?? ''
  const statusMatch = statusLine.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/i)
  if (!statusMatch) {
    if (ended) {
      throwInvalidHttp1(view)
    }
    return null
  }
  const status = Number(statusMatch[1])
  const headers: Record<string, string> = {}
  for (const line of lines.slice(1)) {
    const colon = line.indexOf(':')
    if (colon === -1) {
      continue
    }
    headers[line.slice(0, colon).trim().toLowerCase()] = line
      .slice(colon + 1)
      .trim()
  }

  if (headers['transfer-encoding']?.toLowerCase().includes('chunked')) {
    const decoded = tryDecodeChunkedBody(rest)
    if (!decoded) {
      return null
    }
    return { body: decoded, status }
  }

  const lengthHeader = headers['content-length']
  if (lengthHeader !== undefined) {
    const length = Number(lengthHeader)
    if (!Number.isFinite(length) || length < 0) {
      throw new Error('Invalid Content-Length from LND')
    }
    if (rest.length < length) {
      return null
    }
    return { body: asBuffer(rest.subarray(0, length)), status }
  }

  if (!ended) {
    return null
  }
  return { body: rest, status }
}

function findHeaderSeparator(
  view: Buffer
): { index: number; length: number } | null {
  const crlf = indexOfBytes(view, HEADER_SEPARATOR_CRLF)
  const lf = indexOfBytes(view, HEADER_SEPARATOR_LF)
  if (crlf === -1 && lf === -1) {
    return null
  }
  if (crlf === -1) {
    return { index: lf, length: 2 }
  }
  if (lf === -1 || crlf <= lf) {
    return { index: crlf, length: 4 }
  }
  return { index: lf, length: 2 }
}

function throwInvalidHttp1(view: Buffer): never {
  const preview = asBuffer(view.subarray(0, 48))
    .toString('latin1')
    .replace(/[^\x20-\x7e]/g, '.')
  throw new Error(
    preview
      ? `Invalid HTTP response from LND (${preview})`
      : 'Invalid HTTP response from LND'
  )
}

function tryDecodeChunkedBody(buf: Buffer, offset = 0, parts: Buffer[] = []): Buffer | null {
  const lineEndCrlf = indexOfBytes(buf, CRLF, offset)
  const lineEndLf = indexOfBytes(buf, LF, offset)
  const useCrlf =
    lineEndCrlf !== -1 && (lineEndLf === -1 || lineEndCrlf <= lineEndLf)
  const lineEnd = useCrlf ? lineEndCrlf : lineEndLf
  const lineSepLen = useCrlf ? 2 : 1
  if (lineEnd === -1) {
    return null
  }
  const sizeLine = asBuffer(buf.subarray(offset, lineEnd))
    .toString('ascii')
    .replace(/\r$/, '')
  const sizeHex = sizeLine.split(';', 1)[0]?.trim() ?? '0'
  const size = Number.parseInt(sizeHex, 16)
  if (!Number.isFinite(size) || size < 0) {
    throw new Error('Invalid chunked encoding from LND')
  }
  const dataStart = lineEnd + lineSepLen
  if (size === 0) {
    return Buffer.concat(parts)
  }
  if (buf.length < dataStart + size + lineSepLen) {
    return null
  }
  const nextOffset = dataStart + size + lineSepLen
  return tryDecodeChunkedBody(buf, nextOffset, [
    ...parts,
    asBuffer(buf.subarray(dataStart, dataStart + size))
  ])
}
