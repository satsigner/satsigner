import NDK from '@nostr-dev-kit/ndk'
import WsWebSocket from 'ws'

import { disconnectTestNdks, trackNdk } from './testNdk'

// The relay suite exercises the real transport stack; the shared manual mocks
// in tests/__mocks__ stub exactly that.
jest.mock<typeof import('@nostr-dev-kit/ndk')>('@nostr-dev-kit/ndk', () =>
  jest.requireActual('@nostr-dev-kit/ndk')
)
jest.mock<typeof import('nostr-tools')>('nostr-tools', () =>
  jest.requireActual('nostr-tools')
)

// A root __mocks__ file wins over moduleNameMapper, so the node:sqlite
// backing has to be installed as an explicit mock.
jest.mock('react-native-nitro-sqlite', () =>
  jest.requireActual('./nodeNitroSqlite')
)

jest.mock<typeof import('@react-native-community/netinfo')>(
  '@react-native-community/netinfo',
  () =>
    jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js')
)

// Node's built-in WebSocket never fires `close` after a refused handshake,
// unlike React Native's, so NDK would stay CONNECTING forever. The `ws`
// client matches the React Native behaviour.
Object.defineProperty(globalThis, 'WebSocket', {
  configurable: true,
  value: WsWebSocket,
  writable: true
})

// NDK arms monitor intervals and reconnect backoffs (up to minutes) that it
// never clears once a relay is gone, so a run would never exit. Unref'd timers
// still fire while a test awaits them but cannot keep the worker alive.
const refSetTimeout = globalThis.setTimeout
const refSetInterval = globalThis.setInterval

globalThis.setTimeout = Object.assign(
  (...args: Parameters<typeof refSetTimeout>) => refSetTimeout(...args).unref(),
  refSetTimeout
)
globalThis.setInterval = Object.assign(
  (...args: Parameters<typeof refSetInterval>) =>
    refSetInterval(...args).unref(),
  refSetInterval
)

const originalConnect = NDK.prototype.connect

jest
  .spyOn(NDK.prototype, 'connect')
  .mockImplementation(function connectTracked(this: NDK, timeoutMs) {
    trackNdk(this)
    return originalConnect.call(this, timeoutMs)
  })

afterEach(() => {
  disconnectTestNdks()
})
