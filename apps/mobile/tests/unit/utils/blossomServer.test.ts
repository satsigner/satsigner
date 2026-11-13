import { normalizeBlossomServerUrl } from '@/utils/blossomServer'

describe('normalizeBlossomServerUrl', () => {
  it('adds https to a host typed without a scheme', () => {
    expect(normalizeBlossomServerUrl('cdn.example.com')).toBe(
      'https://cdn.example.com'
    )
    expect(normalizeBlossomServerUrl(' httpcdn.example.com/ ')).toBe(
      'https://httpcdn.example.com'
    )
  })

  it('keeps an http or https scheme the user typed', () => {
    expect(normalizeBlossomServerUrl('HTTPS://Cdn.Example.com/blossom/')).toBe(
      'https://cdn.example.com/blossom'
    )
    expect(normalizeBlossomServerUrl('http://192.168.1.10:3000')).toBe(
      'http://192.168.1.10:3000'
    )
  })

  it('rejects other schemes and addresses without a host', () => {
    expect(normalizeBlossomServerUrl('ftp://cdn.example.com')).toBeNull()
    expect(normalizeBlossomServerUrl('wss://cdn.example.com')).toBeNull()
    expect(normalizeBlossomServerUrl('https://')).toBeNull()
    expect(normalizeBlossomServerUrl('')).toBeNull()
    expect(normalizeBlossomServerUrl('not a host')).toBeNull()
  })
})
