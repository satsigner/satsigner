import { pairingCertToPem } from '@/utils/lndTlsCert'
import { looksLikeHttp2Session } from '@/utils/lndHttp2'
import {
  buildLndHttp1Request,
  tryParseHttp1Response
} from '@/utils/lndHttpMessage'

describe('pairingCertToPem', () => {
  it('passes through an existing PEM block', () => {
    const pem =
      '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----'
    expect(pairingCertToPem(pem)).toBe(`${pem}\n`)
  })

  it('wraps url-safe base64 of the PEM body', () => {
    const body = 'MIIBpjCCAQ+gAwIBAgIRA'
    const encoded = Buffer.from(body)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const pem = pairingCertToPem(encoded)
    expect(pem.startsWith('-----BEGIN CERTIFICATE-----')).toBe(true)
    expect(pem).toContain(body)
    expect(pem.endsWith('-----END CERTIFICATE-----\n')).toBe(true)
  })

  it('wraps raw DER (SEQUENCE tag)', () => {
    const der = Buffer.from([0x30, 0x03, 0x02, 0x01, 0x00])
    const encoded = der
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const pem = pairingCertToPem(encoded)
    expect(pem).toContain(der.toString('base64'))
  })
})

describe('lndHttpMessage', () => {
  it('builds a GET with macaroon and host', () => {
    const req = buildLndHttp1Request({
      body: '',
      headers: {},
      hostHeader: 'h.onion:8080',
      macaroon: 'abcd',
      method: 'GET',
      pathWithQuery: '/v1/getinfo'
    })
    expect(req.startsWith('GET /v1/getinfo HTTP/1.1\r\n')).toBe(true)
    expect(req).toContain('Host: h.onion:8080')
    expect(req).toContain('Grpc-Metadata-macaroon: abcd')
    expect(req.endsWith('\r\n\r\n')).toBe(true)
  })

  it('parses Content-Length responses', () => {
    const body = '{"ok":true}'
    const raw = Buffer.from(
      `HTTP/1.1 200 OK\r\nContent-Length: ${body.length}\r\n\r\n${body}`
    )
    expect(tryParseHttp1Response(raw)).toEqual({
      body: Buffer.from(body),
      status: 200
    })
  })

  it('returns null until the body is complete', () => {
    const raw = Buffer.from('HTTP/1.1 200 OK\r\nContent-Length: 10\r\n\r\nabc')
    expect(tryParseHttp1Response(raw)).toBeNull()
  })

  it('parses chunked bodies', () => {
    const raw = Buffer.from(
      'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n0\r\n\r\n'
    )
    expect(tryParseHttp1Response(raw)?.body.toString()).toBe('hello')
  })

  it('parses LF-only HTTP/1 responses', () => {
    const body = '{"ok":true}'
    const raw = Buffer.from(
      `HTTP/1.1 200 OK\nContent-Length: ${body.length}\n\n${body}`
    )
    expect(tryParseHttp1Response(raw)).toEqual({
      body: Buffer.from(body),
      status: 200
    })
  })

  it('does not treat HTTP/2 frames as HTTP/1', () => {
    const settings = Buffer.from([0, 0, 0, 0x04, 0, 0, 0, 0, 0, 13, 10, 13, 10])
    expect(tryParseHttp1Response(settings)).toBeNull()
    expect(tryParseHttp1Response(settings, true)).toBeNull()
  })
})

describe('looksLikeHttp2Session', () => {
  it('detects a SETTINGS frame without Buffer.equals', () => {
    const settings = Buffer.from([0, 0, 0, 0x04, 0, 0, 0, 0, 0])
    settings.subarray = function subarray(start?: number, end?: number) {
      return Uint8Array.prototype.subarray.call(this, start, end)
    }
    expect(looksLikeHttp2Session(settings)).toBe(true)
  })
})
