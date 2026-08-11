/* eslint-disable @typescript-eslint/no-explicit-any */
// Minimal mock of react-native-tcp-socket for electrum-client tests.
// Records TLSSocket constructor options so tests can assert TLS settings.

class FakeSocket {
  static instances: FakeSocket[] = []

  connect = jest.fn()
  destroy = jest.fn()
  end = jest.fn()
  on = jest.fn(() => this)
  setEncoding = jest.fn(() => this)
  setKeepAlive = jest.fn(() => this)
  setNoDelay = jest.fn(() => this)
  setTimeout = jest.fn(() => this)
  write = jest.fn()

  constructor() {
    FakeSocket.instances.push(this)
  }
}

class FakeTLSSocket extends FakeSocket {
  static lastOptions: Record<string, unknown> | undefined

  constructor(_socket: unknown, options?: Record<string, unknown>) {
    super()
    FakeTLSSocket.lastOptions = options
  }

  getPeerCertificate() {
    return {}
  }
}

export default {
  Socket: FakeSocket,
  TLSSocket: FakeTLSSocket,
  connectTLS: jest.fn(),
  createConnection: jest.fn(),
  createServer: jest.fn(),
  createTLSServer: jest.fn(),
  hasIdentity: jest.fn()
}
