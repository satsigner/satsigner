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

function waitForBytes(socket: TcpSocketInstance, byteCount: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0

    function cleanup() {
      socket.off('data', onData)
      socket.off('error', onError)
      socket.off('close', onClose)
    }

    function onData(chunk: Buffer | string) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      chunks.push(buffer)
      total += buffer.length
      if (total >= byteCount) {
        cleanup()
        resolve(Buffer.concat(chunks).subarray(0, byteCount))
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

function readHttpResponse(raw: string): ParsedHttpResponse {
  const separatorIndex = raw.indexOf('\r\n\r\n')
  if (separatorIndex === -1) {
    throw new Error('Invalid HTTP response')
  }

  const headerSection = raw.slice(0, separatorIndex)
  const body = raw.slice(separatorIndex + 4)
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

  return { body, headers, status }
}

async function openSocksTunnel(
  proxy: ProxyConfig,
  targetHost: string,
  targetPort: number
): Promise<TcpSocketInstance> {
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

  socket.write(Buffer.from([0x05, 0x01, 0x00]))
  const authResponse = await waitForBytes(socket, 2)
  if (authResponse[0] !== 0x05 || authResponse[1] !== 0x00) {
    throw new Error('SOCKS5 authentication failed')
  }

  socket.write(buildSocksConnectRequest(targetHost, targetPort))
  const connectHeader = await waitForBytes(socket, 4)
  if (connectHeader[0] !== 0x05 || connectHeader[1] !== 0x00) {
    throw new Error('SOCKS5 connect failed')
  }

  if (connectHeader[3] === 0x01) {
    await waitForBytes(socket, 4 + 2)
  } else if (connectHeader[3] === 0x03) {
    const lengthBuffer = await waitForBytes(socket, 1)
    await waitForBytes(socket, lengthBuffer[0] + 2)
  } else if (connectHeader[3] === 0x04) {
    await waitForBytes(socket, 16 + 2)
  }

  return socket
}

function collectSocketData(socket: TcpSocketInstance): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

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
      resolve(Buffer.concat(chunks).toString('utf8'))
    }

    socket.on('data', onData)
    socket.on('error', onError)
    socket.on('close', onClose)
  })
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

  const targetPort = parsedUrl.port
    ? Number.parseInt(parsedUrl.port, 10)
    : 443
  const plainSocket = await openSocksTunnel(
    proxy,
    parsedUrl.hostname,
    targetPort
  )
  const tlsSocket = new TcpSocket.TLSSocket(plainSocket)

  await new Promise<void>((resolve, reject) => {
    tlsSocket.once('secureConnect', () => {
      resolve()
    })
    tlsSocket.once('error', reject)
  })

  const method = init?.method ?? 'GET'
  const headerLines = [`${method} ${parsedUrl.pathname}${parsedUrl.search} HTTP/1.1`]
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

  tlsSocket.write(headerLines.join('\r\n'))

  const rawResponse = await collectSocketData(tlsSocket)
  tlsSocket.destroy()

  const parsedResponse = readHttpResponse(rawResponse)
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
