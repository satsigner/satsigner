import TcpSocket from 'react-native-tcp-socket'

import { lndRestFetch } from '@/api/lndRest'
import { takeHttp2Frames } from '@/utils/lndHttp2'
import { pairingCertToPem } from '@/utils/lndTlsCert'

type Listener = (...args: unknown[]) => void

const FRAME_DATA = 0x00
const FRAME_HEADERS = 0x01
const FRAME_SETTINGS = 0x04
const FRAME_WINDOW_UPDATE = 0x08
const FLAG_END_STREAM = 0x01
const FLAG_END_HEADERS = 0x04
const STREAM_ID = 1
const INITIAL_WINDOW_SIZE = 65_535
const MAX_FRAME_SIZE = 16_384
const HTTP2_CONFIG = {
  cert: Buffer.from('MIIB').toString('base64'),
  macaroon: 'aa',
  url: 'https://node.example:8080'
}

function http2Frame(
  type: number,
  flags: number,
  streamId: number,
  payload: Buffer
) {
  const header = Buffer.alloc(9)
  header.writeUIntBE(payload.length, 0, 3)
  header[3] = type
  header[4] = flags
  header.writeUInt32BE(streamId, 5)
  return Buffer.concat([header, payload])
}

function http2DataFrames(body: Buffer, endStream: boolean) {
  const count = Math.ceil(body.length / MAX_FRAME_SIZE)
  return Array.from({ length: count }, (_, index) =>
    http2Frame(
      FRAME_DATA,
      endStream && index === count - 1 ? FLAG_END_STREAM : 0,
      STREAM_ID,
      body.subarray(index * MAX_FRAME_SIZE, (index + 1) * MAX_FRAME_SIZE)
    )
  )
}

const SERVER_SETTINGS = http2Frame(FRAME_SETTINGS, 0, 0, Buffer.alloc(0))

function http2ResponseHeaders(hpackBlock: number[]) {
  return http2Frame(
    FRAME_HEADERS,
    FLAG_END_HEADERS,
    STREAM_ID,
    Buffer.from(hpackBlock)
  )
}

/**
 * Answers the first (HTTP/1) connection with an HTTP/2 SETTINGS frame so the
 * client retries over HTTP/2, then hands every HTTP/2 client write to
 * `onHttp2Write`. Server frames are delivered asynchronously, like a socket.
 */
function mockHttp2Server(
  onHttp2Write: (
    bytes: Buffer,
    send: (data: Buffer) => void,
    isRequest: boolean
  ) => void
) {
  const opened: number[] = []
  jest.mocked(TcpSocket.connectTLS).mockImplementation(() => {
    opened.push(opened.length)
    const isHttp2 = opened.length > 1
    const listeners = new Map<string, Listener[]>()

    function emit(event: string, ...args: unknown[]) {
      for (const listener of listeners.get(event) ?? []) {
        listener(...args)
      }
    }

    function send(data: Buffer) {
      queueMicrotask(() => emit('data', data))
    }

    const socket = {
      destroy: jest.fn(),
      on(event: string, listener: Listener) {
        listeners.set(event, [...(listeners.get(event) ?? []), listener])
        return socket
      },
      write(data: Buffer | string) {
        const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data)
        if (!isHttp2) {
          send(SERVER_SETTINGS)
          return true
        }
        onHttp2Write(bytes, send, bytes.subarray(0, 3).toString() === 'PRI')
        return true
      }
    }
    queueMicrotask(() => emit('secureConnect'))
    return socket
  })
}

describe('lndRestFetch', () => {
  it('passes the pairing cert as TLS ca and returns JSON', async () => {
    const certBody = 'MIIBpjCCAQ+gAwIBAgIRA'
    const encodedCert = Buffer.from(certBody).toString('base64')
    const listeners = new Map<string, Listener[]>()
    const connectTLS = jest.mocked(TcpSocket.connectTLS)

    connectTLS.mockImplementation((options: Record<string, unknown>) => {
      const socket = {
        destroy: jest.fn(),
        on(event: string, listener: Listener) {
          const list = listeners.get(event) ?? []
          list.push(listener)
          listeners.set(event, list)
          return socket
        },
        write() {
          const body = '{"identity_pubkey":"pk"}'
          const res = `HTTP/1.1 200 OK\r\nContent-Length: ${body.length}\r\n\r\n${body}`
          for (const listener of listeners.get('data') ?? []) {
            listener(Buffer.from(res))
          }
          return true
        }
      }
      queueMicrotask(() => {
        for (const listener of listeners.get('secureConnect') ?? []) {
          listener()
        }
      })
      expect(options.ca).toBe(pairingCertToPem(encodedCert))
      expect(options.host).toBe('node.example')
      expect(options.port).toBe(8080)
      expect(options.rejectUnauthorized).toBe(true)
      return socket
    })

    const response = await lndRestFetch(
      {
        cert: encodedCert,
        macaroon: 'aa',
        url: 'https://node.example:8080'
      },
      '/v1/getinfo'
    )
    expect(response.ok).toBe(true)
    await expect(response.json()).resolves.toStrictEqual({
      identity_pubkey: 'pk'
    })
  })

  it('retries with HTTP/2 when LND REST is HTTP/2', async () => {
    const encodedCert = Buffer.from('MIIB').toString('base64')
    const connectTLS = jest.mocked(TcpSocket.connectTLS)
    let connections = 0

    connectTLS.mockImplementation(() => {
      connections += 1
      const connection = connections
      const listeners = new Map<string, Listener[]>()
      const socket = {
        destroy: jest.fn(),
        on(event: string, listener: Listener) {
          const list = listeners.get(event) ?? []
          list.push(listener)
          listeners.set(event, list)
          return socket
        },
        write(data: Buffer | string) {
          const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data)
          if (connection === 1) {
            const settings = Buffer.from([0, 0, 0, 0x04, 0, 0, 0, 0, 0])
            for (const listener of listeners.get('data') ?? []) {
              listener(settings)
            }
            return true
          }
          if (bytes.subarray(0, 3).toString() !== 'PRI') {
            return true
          }
          const body = '{"identity_pubkey":"pk"}'
          const headers = Buffer.concat([
            Buffer.from([0, 0, 1, 0x01, 0x04, 0, 0, 0, 1, 0x88])
          ])
          const dataHeader = Buffer.alloc(9)
          const payload = Buffer.from(body)
          dataHeader[2] = payload.length
          dataHeader[3] = 0
          dataHeader[4] = 0x01
          dataHeader.writeUInt32BE(1, 5)
          const res = Buffer.concat([
            Buffer.from([0, 0, 0, 0x04, 0, 0, 0, 0, 0]),
            headers,
            dataHeader,
            payload
          ])
          for (const listener of listeners.get('data') ?? []) {
            listener(res)
          }
          return true
        }
      }
      queueMicrotask(() => {
        for (const listener of listeners.get('secureConnect') ?? []) {
          listener()
        }
      })
      return socket
    })

    const response = await lndRestFetch(
      {
        cert: encodedCert,
        macaroon: 'aa',
        url: 'https://node.example:8080'
      },
      '/v1/getinfo'
    )
    expect(connections).toBe(2)
    expect(response.ok).toBe(true)
    await expect(response.json()).resolves.toStrictEqual({
      identity_pubkey: 'pk'
    })
  })

  it('returns flow-control credit so a response larger than the initial window completes', async () => {
    const body = Buffer.from(
      JSON.stringify({ payments: 'x'.repeat(INITIAL_WINDOW_SIZE * 2) })
    )
    const firstWindow = body.subarray(0, INITIAL_WINDOW_SIZE)
    const credit = new Map<number, number>()
    const server = { sentRest: false }

    mockHttp2Server((bytes, send, isRequest) => {
      if (isRequest) {
        send(
          Buffer.concat([
            SERVER_SETTINGS,
            http2ResponseHeaders([0x88]),
            ...http2DataFrames(firstWindow, false)
          ])
        )
        return
      }
      const updates = takeHttp2Frames(bytes).frames.filter(
        (frame) => frame.type === FRAME_WINDOW_UPDATE
      )
      for (const update of updates) {
        credit.set(
          update.streamId,
          (credit.get(update.streamId) ?? 0) + update.payload.readUInt32BE(0)
        )
      }
      const windowRefilled = [0, STREAM_ID].every(
        (streamId) => (credit.get(streamId) ?? 0) >= firstWindow.length
      )
      if (!windowRefilled || server.sentRest) {
        return
      }
      server.sentRest = true
      send(
        Buffer.concat(http2DataFrames(body.subarray(INITIAL_WINDOW_SIZE), true))
      )
    })

    const response = await lndRestFetch(HTTP2_CONFIG, '/v1/payments')

    expect(response.ok).toBe(true)
    await expect(response.text()).resolves.toBe(body.toString())
  })

  it('reports the real status when LND Huffman-encodes it', async () => {
    const body = '{"code":2,"message":"verification failed"}'

    mockHttp2Server((_bytes, send, isRequest) => {
      if (!isRequest) {
        return
      }
      send(
        Buffer.concat([
          SERVER_SETTINGS,
          // Literal :status (static index 14), Huffman "401", as Go encodes it.
          http2ResponseHeaders([0x4e, 0x82, 0x68, 0x01]),
          ...http2DataFrames(Buffer.from(body), true)
        ])
      )
    })

    const response = await lndRestFetch(HTTP2_CONFIG, '/v1/getinfo')

    expect(response.ok).toBe(false)
    expect(response.status).toBe(401)
    await expect(response.text()).resolves.toBe(body)
  })
})
