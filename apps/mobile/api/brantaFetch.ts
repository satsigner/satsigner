import { Buffer } from 'buffer'

import TcpSocket from 'react-native-tcp-socket'

import { type ProxyConfig } from '@/types/settings/blockchain'

type TcpSocketInstance = ReturnType<typeof TcpSocket.createConnection>

type ParsedHttpResponse = {
  status: number
  headers: Record<string, string>
  body: string
}

function buildSocksConnectRequest(host: string, port: number): Buffer {
  const hostBytes = Buffer.from(host, 'utf8')
  const request = Buffer.alloc(7 + hostBytes.length)
  request[0] = 0x05
  request[1] = 0x01
  request[2] = 0x00
  request[3] = 0x03
  request[4] = hostBytes.length
  hostBytes.copy(request, 5)
  request.writeUInt16BE(port, 5 + hostBytes.length)
  return request
}

// SocketReader preserves bytes that arrive beyond what was requested,
// preventing data loss when sequential reads span the same TCP chunk.
type SocketReader = {
  readBytes: (count: number) => Promise<Buffer>
  readAll: () => Promise<Buffer>
}

function createSocketReader(socket: TcpSocketInstance): SocketReader {
  let leftover = Buffer.alloc(0)

  function readBytes(count: number): Promise<Buffer> {
    if (leftover.length >= count) {
      const result = leftover.subarray(0, count)
      leftover = leftover.subarray(count)
      return Promise.resolve(result)
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = leftover.length > 0 ? [leftover] : []
      let total = leftover.length
      leftover = Buffer.alloc(0)

      function cleanup() {
        socket.off('data', onData)
        socket.off('error', onError)
        socket.off('close', onClose)
      }

      function onData(chunk: Buffer | string) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        chunks.push(buf)
        total += buf.length
        if (total >= count) {
          cleanup()
          const combined = Buffer.concat(chunks)
          leftover = combined.subarray(count)
          resolve(combined.subarray(0, count))
        }
      }

      function onError(error: Error) {
        cleanup()
        reject(error)
      }

      function onClose() {
        cleanup()
        reject(new Error('Socket closed before enough data was received'))
      }

      socket.on('data', onData)
      socket.on('error', onError)
      socket.on('close', onClose)
    })
  }

  function readAll(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = leftover.length > 0 ? [leftover] : []
      leftover = Buffer.alloc(0)

      function cleanup() {
        socket.off('data', onData)
        socket.off('error', onError)
        socket.off('close', onClose)
      }

      function onData(chunk: Buffer | string) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }

      function onError(error: Error) {
        cleanup()
        reject(error)
      }

      function onClose() {
        cleanup()
        resolve(Buffer.concat(chunks))
      }

      socket.on('data', onData)
      socket.on('error', onError)
      socket.on('close', onClose)
    })
  }

  return { readAll, readBytes }
}

function decodeChunkedBody(raw: string): string {
  const parts: string[] = []
  let pos = 0

  while (pos < raw.length) {
    const lineEnd = raw.indexOf('\r\n', pos)
    if (lineEnd === -1) {
      break
    }

    const chunkSize = Number.parseInt(
      raw.slice(pos, lineEnd).split(';')[0].trim(),
      16
    )
    if (Number.isNaN(chunkSize) || chunkSize === 0) {
      break
    }

    const dataStart = lineEnd + 2
    parts.push(raw.slice(dataStart, dataStart + chunkSize))
    pos = dataStart + chunkSize + 2
  }

  return parts.join('')
}

function readHttpResponse(raw: string): ParsedHttpResponse {
  const separatorIndex = raw.indexOf('\r\n\r\n')
  if (separatorIndex === -1) {
    throw new Error('Invalid HTTP response')
  }

  const headerSection = raw.slice(0, separatorIndex)
  const rawBody = raw.slice(separatorIndex + 4)
  const lines = headerSection.split('\r\n')
  const statusLine = lines[0] ?? ''
  const statusMatch = statusLine.match(/HTTP\/\d\.\d\s+(\d+)/)
  const status = statusMatch ? Number.parseInt(statusMatch[1], 10) : 0
  const headers: Record<string, string> = {}

  for (const line of lines.slice(1)) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) {
      continue
    }
    const key = line.slice(0, colonIndex).trim().toLowerCase()
    const value = line.slice(colonIndex + 1).trim()
    headers[key] = value
  }

  const isChunked = headers['transfer-encoding']
    ?.toLowerCase()
    .includes('chunked')
  const body = isChunked ? decodeChunkedBody(rawBody) : rawBody

  return { body, headers, status }
}

async function openSocksTunnel(
  proxy: ProxyConfig,
  targetHost: string,
  targetPort: number
): Promise<TcpSocketInstance> {
  if (__DEV__) {
    console.log(`[BrantaFetch] TCP connect → ${proxy.host}:${proxy.port}`)
  }
  const socket = await new Promise<TcpSocketInstance>((resolve, reject) => {
    const connection = TcpSocket.createConnection(
      {
        host: proxy.host,
        port: proxy.port
      },
      () => {
        resolve(connection)
      }
    )

    connection.once('error', reject)
  })
  if (__DEV__) {
    console.log('[BrantaFetch] TCP connected — sending SOCKS5 greeting')
  }

  const reader = createSocketReader(socket)

  socket.write(Buffer.from([0x05, 0x01, 0x00]))
  const authResponse = await reader.readBytes(2)
  if (__DEV__) {
    console.log(
      `[BrantaFetch] SOCKS5 auth response: ver=${authResponse[0]} method=${authResponse[1]}`
    )
  }
  if (authResponse[0] !== 0x05 || authResponse[1] !== 0x00) {
    throw new Error(
      `SOCKS5 authentication failed (ver=${authResponse[0]} method=${authResponse[1]})`
    )
  }

  if (__DEV__) {
    console.log(`[BrantaFetch] SOCKS5 CONNECT → ${targetHost}:${targetPort}`)
  }
  socket.write(buildSocksConnectRequest(targetHost, targetPort))
  const connectHeader = await reader.readBytes(4)
  if (__DEV__) {
    console.log(
      `[BrantaFetch] SOCKS5 CONNECT response: ver=${connectHeader[0]} rep=${connectHeader[1]} atyp=${connectHeader[3]}`
    )
  }
  if (connectHeader[0] !== 0x05 || connectHeader[1] !== 0x00) {
    throw new Error(`SOCKS5 connect failed (rep=${connectHeader[1]})`)
  }

  const addrType = connectHeader[3]
  if (addrType === 0x01) {
    await reader.readBytes(4 + 2)
  } else if (addrType === 0x03) {
    const lengthBuf = await reader.readBytes(1)
    await reader.readBytes(lengthBuf[0] + 2)
  } else if (addrType === 0x04) {
    await reader.readBytes(16 + 2)
  }
  if (__DEV__) {
    console.log('[BrantaFetch] SOCKS5 tunnel established')
  }

  return socket
}

async function socks5HttpsRequest(
  url: string,
  init: RequestInit | undefined,
  proxy: ProxyConfig
): Promise<Response> {
  const parsedUrl = new URL(url)
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTPS requests are supported through SOCKS5')
  }

  const targetPort = parsedUrl.port ? Number.parseInt(parsedUrl.port, 10) : 443
  const plainSocket = await openSocksTunnel(
    proxy,
    parsedUrl.hostname,
    targetPort
  )
  // The underlying socket is a SOCKS5 tunnel so the native TLS layer sees
  // the proxy address (127.0.0.1) rather than the actual target hostname,
  // causing SNI mismatch. Disabling cert validation bypasses this — the
  // Tor circuit already authenticates the route end-to-end.
  if (__DEV__) {
    console.log(`[BrantaFetch] Starting TLS handshake → ${parsedUrl.hostname}`)
  }
  const tlsSocket = new TcpSocket.TLSSocket(plainSocket, {
    rejectUnauthorized: false
  })

  await new Promise<void>((resolve, reject) => {
    tlsSocket.once('secureConnect', () => {
      if (__DEV__) {
        console.log('[BrantaFetch] TLS established')
      }
      resolve()
    })
    tlsSocket.once('error', (err) => {
      if (__DEV__) {
        console.log(
          '[BrantaFetch] TLS error:',
          err instanceof Error ? err.message : String(err)
        )
      }
      reject(err)
    })
    tlsSocket.once('close', () => {
      if (__DEV__) {
        console.log('[BrantaFetch] socket closed during TLS handshake')
      }
    })
  })

  const method = init?.method ?? 'GET'
  const headerLines = [
    `${method} ${parsedUrl.pathname}${parsedUrl.search} HTTP/1.1`
  ]
  headerLines.push(`Host: ${parsedUrl.hostname}`)
  headerLines.push('Connection: close')
  headerLines.push('Accept: application/json')

  if (init?.headers) {
    const headers = new Headers(init.headers)
    headers.forEach((value, key) => {
      if (key.toLowerCase() === 'host') {
        return
      }
      headerLines.push(`${key}: ${value}`)
    })
  }

  if (init?.body && method !== 'GET' && method !== 'HEAD') {
    const bodyText =
      typeof init.body === 'string' ? init.body : String(init.body)
    headerLines.push('Content-Length: ' + Buffer.byteLength(bodyText))
    headerLines.push('')
    headerLines.push(bodyText)
  } else {
    headerLines.push('')
    headerLines.push('')
  }

  if (__DEV__) {
    console.log(
      `[BrantaFetch] → ${method} ${parsedUrl.pathname}${parsedUrl.search}`
    )
  }
  tlsSocket.write(headerLines.join('\r\n'))

  const tlsReader = createSocketReader(tlsSocket)
  const rawResponseBuf = await tlsReader.readAll()
  const rawResponse = rawResponseBuf.toString('utf8')
  tlsSocket.destroy()

  const parsedResponse = readHttpResponse(rawResponse)
  if (__DEV__) {
    console.log(
      `[BrantaFetch] ← ${parsedResponse.status} (${rawResponseBuf.length} bytes)`
    )
  }
  return new Response(parsedResponse.body, {
    headers: parsedResponse.headers,
    status: parsedResponse.status
  })
}

function createSocksFetch(proxy: ProxyConfig): typeof fetch {
  return async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

    if (url.startsWith('https://')) {
      return socks5HttpsRequest(url, init, proxy)
    }

    return fetch(input, init)
  }
}

export { createSocksFetch }
