import { isOnionUrl } from '@/utils/serverPrivacy'

const ONION_HOST =
  'explorerzydxu5ecjrkwceayqybizmpjjznk5izmitf2modhcusuqlid.onion'

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
