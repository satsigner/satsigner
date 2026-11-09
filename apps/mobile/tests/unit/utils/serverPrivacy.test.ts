import { isOnionUrl } from '@/utils/serverPrivacy'

const ONION_HOST =
  'explorerzydxu5ecjrkwceayqybizmpjjznk5izmitf2modhcusuqlid.onion'

describe('isOnionUrl', () => {
  it.each([
    `tcp://${ONION_HOST}:50001`,
    `ssl://${ONION_HOST}:50002`,
    `http://${ONION_HOST}/api`,
    `ssl://electrum.${ONION_HOST}:50002`,
    `ssl://my_node.${ONION_HOST}:50002`,
    `https://${ONION_HOST}?x=1`,
    `https://${ONION_HOST}#top`,
    `https://${ONION_HOST}./api`,
    ONION_HOST
  ])('detects %s', (url) => {
    expect(isOnionUrl(url)).toBe(true)
  })

  it.each([
    'ssl://electrum.blockstream.info:50002',
    'https://mempool.space/api',
    'https://example.com/a.onion',
    `https://user:${ONION_HOST}@example.com/api`,
    `https://example.com?target=@${ONION_HOST}`,
    `https://example.com#@${ONION_HOST}`
  ])('rejects %s', (url) => {
    expect(isOnionUrl(url)).toBe(false)
  })
})
