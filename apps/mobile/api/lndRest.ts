import { Buffer } from 'buffer'

import TcpSocket from 'react-native-tcp-socket'

import { LND_REST_TIMEOUT_MS } from '@/constants/lightning'
import type { LNDConfig } from '@/types/models/Lightning'
import {
  buildHttp2HeadersEndStream,
  buildHttp2Post,
  buildHttp2PrefaceAndSettings,
  http2PingAck,
  http2SettingsAck,
  isGoawayFrame,
  isRstStreamFrame,
  looksLikeHttp2Session,
  statusFromHpackHeaders,
  takeHttp2Frames
} from '@/utils/lndHttp2'
import {
  buildLndHttp1Request,
  startsWithHttp1Response,
  tryParseHttp1Response
} from '@/utils/lndHttpMessage'
import { pairingCertToPem } from '@/utils/lndTlsCert'

type LndRestRequestInit = {
  body?: string
  headers?: Record<string, string>
  method?: string
}

type TlsSocketLike = {
  destroy: () => void
  on: (event: string, listener: (...args: unknown[]) => void) => unknown
  write: (data: string | Buffer) => unknown
}

function resolveLndRequestUrl(config: LNDConfig, pathOrUrl: string): URL {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return new URL(pathOrUrl)
  }
  const base = config.url.replace(/\/+$/, '')
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return new URL(`${base}${path}`)
}

function toBuffer(data: unknown): Buffer {
  if (typeof data === 'string') {
    return Buffer.from(data)
  }
  if (Buffer.isBuffer(data)) {
    return data
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data)
  }
  return Buffer.from(String(data))
}

function hostHeaderFor(parsed: URL): string {
  const hostname = parsed.hostname.includes(':')
    ? `[${parsed.hostname}]`
    : parsed.hostname
  const port = parsed.port
  if (!port || port === '443') {
    return hostname
  }
  return `${hostname}:${port}`
}

function tlsConnectOptions(parsed: URL, config: LNDConfig) {
  const port = Number(parsed.port || '443')
  const cert = config.cert.trim()
  if (!cert) {
    return {
      connectTimeout: LND_REST_TIMEOUT_MS,
      host: parsed.hostname,
      port,
      rejectUnauthorized: true
    }
  }
  return {
    ca: pairingCertToPem(cert),
    connectTimeout: LND_REST_TIMEOUT_MS,
    host: parsed.hostname,
    port,
    rejectUnauthorized: true
  }
}

function readHttpResponse(
  socket: TlsSocketLike,
  request: Buffer,
  version: 'http1' | 'http2'
): Promise<{ body: Buffer; status: number; retryHttp2: boolean }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let settled = false
    let wrote = false
    let http2Status: number | null = null
    let http2Pending = Buffer.alloc(0)
    const dataParts: Buffer[] = []

    function finish(
      error: Error | null,
      parsed: { body: Buffer; status: number } | null,
      retryHttp2 = false
    ) {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeoutId)
      socket.destroy()
      if (retryHttp2) {
        resolve({ body: Buffer.alloc(0), retryHttp2: true, status: 0 })
        return
      }
      if (error) {
        reject(error)
        return
      }
      if (!parsed) {
        reject(new Error('Incomplete HTTP response from LND'))
        return
      }
      resolve({ ...parsed, retryHttp2: false })
    }

    function writeRequest() {
      if (wrote || settled) {
        return
      }
      wrote = true
      socket.write(request)
    }

    function handleHttp2Frames(raw: Buffer) {
      http2Pending = Buffer.concat([http2Pending, raw])
      const taken = takeHttp2Frames(http2Pending)
      http2Pending = taken.rest
      for (const frame of taken.frames) {
        if (frame.type === 0x04 && (frame.flags & 0x01) === 0) {
          socket.write(http2SettingsAck())
        }
        if (frame.type === 0x06 && (frame.flags & 0x01) === 0) {
          socket.write(http2PingAck(frame.payload))
        }
        if (isGoawayFrame(frame) || isRstStreamFrame(frame)) {
          finish(new Error('LND closed the HTTP/2 stream'), null)
          return
        }
        if (frame.type === 0x01) {
          const status = statusFromHpackHeaders(frame.payload)
          if (status !== null) {
            http2Status = status
          }
        }
        if (frame.type === 0x00) {
          dataParts.push(frame.payload)
          if ((frame.flags & 0x01) === 0x01) {
            finish(null, {
              body: Buffer.concat(dataParts),
              status: http2Status ?? 200
            })
          }
        }
        if (frame.type === 0x01 && (frame.flags & 0x01) === 0x01) {
          finish(null, {
            body: Buffer.concat(dataParts),
            status: http2Status ?? 200
          })
        }
      }
    }

    const timeoutId = setTimeout(() => {
      finish(new Error('LND REST request timed out'), null)
    }, LND_REST_TIMEOUT_MS)

    socket.on('data', (data: unknown) => {
      const chunk = toBuffer(data)
      chunks.push(chunk)
      const raw = Buffer.concat(chunks)
      try {
        if (version === 'http1') {
          if (looksLikeHttp2Session(raw) && !startsWithHttp1Response(raw)) {
            finish(null, null, true)
            return
          }
          const parsed = tryParseHttp1Response(raw)
          if (parsed) {
            finish(null, parsed)
          }
          return
        }
        handleHttp2Frames(chunk)
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)), null)
      }
    })

    socket.on('error', (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      finish(new Error(message), null)
    })

    socket.on('close', () => {
      const raw = Buffer.concat(chunks)
      try {
        if (version === 'http1') {
          if (looksLikeHttp2Session(raw) && !startsWithHttp1Response(raw)) {
            finish(null, null, true)
            return
          }
          const parsed = tryParseHttp1Response(raw, true)
          finish(null, parsed)
          return
        }
        handleHttp2Frames(Buffer.alloc(0))
        if (!settled) {
          finish(null, null)
        }
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)), null)
      }
    })

    socket.on('secureConnect', writeRequest)
  })
}

function buildRequest(
  version: 'http1' | 'http2',
  parsed: URL,
  config: LNDConfig,
  method: string,
  pathWithQuery: string,
  body: string
): Buffer {
  if (version === 'http1') {
    return Buffer.from(
      buildLndHttp1Request({
        body,
        headers: {},
        hostHeader: hostHeaderFor(parsed),
        macaroon: config.macaroon,
        method,
        pathWithQuery
      }),
      'utf8'
    )
  }
  const preface = buildHttp2PrefaceAndSettings()
  const authority = hostHeaderFor(parsed)
  const emptyBodyMethods = ['GET', 'HEAD', 'DELETE']
  const headers =
    body.length === 0 && emptyBodyMethods.includes(method)
      ? buildHttp2HeadersEndStream({
          authority,
          macaroon: config.macaroon,
          method,
          pathWithQuery
        })
      : buildHttp2Post({
          authority,
          body,
          macaroon: config.macaroon,
          method,
          pathWithQuery
        })
  return Buffer.concat([preface, headers])
}

export type LndRestFetchResult = {
  json: () => Promise<unknown>
  ok: boolean
  status: number
  text: () => Promise<string>
}

/** HTTPS to LND REST using the pairing TLS cert as the trust anchor. */
export async function lndRestFetch(
  config: LNDConfig,
  pathOrUrl: string,
  init: LndRestRequestInit = {}
): Promise<LndRestFetchResult> {
  const parsed = resolveLndRequestUrl(config, pathOrUrl)
  const method = (init.method ?? 'GET').toUpperCase()
  const body = init.body ?? ''
  const pathWithQuery = `${parsed.pathname}${parsed.search}`

  async function perform(version: 'http1' | 'http2') {
    const socket = TcpSocket.connectTLS(
      tlsConnectOptions(parsed, config)
    ) as unknown as TlsSocketLike
    return readHttpResponse(
      socket,
      buildRequest(version, parsed, config, method, pathWithQuery, body),
      version
    )
  }

  const first = await perform('http1')
  const result = first.retryHttp2 ? await perform('http2') : first
  if (result.retryHttp2) {
    throw new Error('LND REST requires HTTP/2 but the retry failed')
  }
  const text = result.body.toString('utf8')
  return {
    json: () => Promise.resolve(JSON.parse(text) as unknown),
    ok: result.status >= 200 && result.status < 300,
    status: result.status,
    text: () => Promise.resolve(text)
  }
}
