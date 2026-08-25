import TcpSocket from 'react-native-tcp-socket'

import { lndRestFetch } from '@/api/lndRest'
import { pairingCertToPem } from '@/utils/lndTlsCert'

type Listener = (...args: unknown[]) => void

describe('lndRestFetch', () => {
  it('passes the pairing cert as TLS ca and returns JSON', async () => {
    const certBody = 'MIIBpjCCAQ+gAwIBAgIRA'
    const encodedCert = Buffer.from(certBody).toString('base64')
    const listeners = new Map<string, Listener[]>()
    const connectTLS = TcpSocket.connectTLS as unknown as jest.Mock

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
    expect(await response.json()).toEqual({ identity_pubkey: 'pk' })
  })

  it('retries with HTTP/2 when LND REST is HTTP/2', async () => {
    const encodedCert = Buffer.from('MIIB').toString('base64')
    const connectTLS = TcpSocket.connectTLS as unknown as jest.Mock
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
    expect(await response.json()).toEqual({ identity_pubkey: 'pk' })
  })
})
