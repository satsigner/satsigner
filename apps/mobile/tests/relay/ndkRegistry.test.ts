import { clearNdkRegistry, getOrCreateNdk } from '@/api/ndkRegistry'

import { CONNECT_TIMEOUT_MS } from './support/testNdk'
import { startTestRelay, type TestRelay } from './support/testRelay'
import { delay, waitFor } from './support/waitFor'

const RECONNECT_WINDOW_MS = 1500
const RELAY_COUNT = 2

describe('ndk registry teardown against the test relays', () => {
  const relays: TestRelay[] = []

  async function connectedPool() {
    relays.push(
      ...(await Promise.all(
        Array.from({ length: RELAY_COUNT }, () => startTestRelay())
      ))
    )
    const ndk = getOrCreateNdk(relays.map(({ url }) => url))
    await ndk.connect(CONNECT_TIMEOUT_MS)
    await waitFor(() => relays.every((relay) => relay.connectionCount() === 1))
  }

  function openConnections() {
    return relays.reduce((sum, relay) => sum + relay.connectionCount(), 0)
  }

  afterEach(async () => {
    clearNdkRegistry()
    await Promise.all(relays.splice(0).map((relay) => relay.stop()))
  })

  it('removing the relays from the pool closes every socket for good', async () => {
    await connectedPool()

    clearNdkRegistry()
    await delay(RECONNECT_WINDOW_MS)

    expect(openConnections()).toBe(0)
  })

  it('clearNdkRegistry leaves no socket reconnecting for an evicted pool', async () => {
    await connectedPool()

    clearNdkRegistry()
    await delay(RECONNECT_WINDOW_MS)

    expect(openConnections()).toBe(0)
  })
})
