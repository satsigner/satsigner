import { getServerPrivacy, isOnionUrl } from '@/utils/serverPrivacy'

const ONION_HOST =
  'explorerzydxu5ecjrkwceayqybizmpjjznk5izmitf2modhcusuqlid.onion'

describe('getServerPrivacy', () => {
  it('treats Bitcoin Core RPC as the user node', () => {
    expect(
      getServerPrivacy({ backend: 'rpc', url: 'http://192.168.0.2:8332' })
    ).toBe('node')
  })

  it('treats a preset server as public even when marked private', () => {
    expect(
      getServerPrivacy({
        backend: 'esplora',
        isPrivate: true,
        url: 'https://mempool.space/api'
      })
    ).toBe('public')
  })

  it('treats a custom server as private only once confirmed', () => {
    const custom = {
      backend: 'electrum' as const,
      url: 'tcp://umbrel.local:50001'
    }

    expect(getServerPrivacy(custom)).toBe('public')
    expect(getServerPrivacy({ ...custom, isPrivate: true })).toBe('private')
  })
})

describe('isOnionUrl', () => {
  it.each([
    `tcp://${ONION_HOST}:50001`,
    `ssl://${ONION_HOST}:50002`,
    `http://${ONION_HOST}/api`,
    ONION_HOST
  ])('detects %s', (url) => {
    expect(isOnionUrl(url)).toBe(true)
  })

  it.each([
    'ssl://electrum.blockstream.info:50002',
    'https://mempool.space/api',
    'https://example.com/a.onion'
  ])('rejects %s', (url) => {
    expect(isOnionUrl(url)).toBe(false)
  })
})
