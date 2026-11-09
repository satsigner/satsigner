import { isSameServer, isSameServerEndpoint } from '@/utils/server'

const HOME = {
  backend: 'electrum' as const,
  name: 'Home',
  url: 'tcp://umbrel.local:50001'
}

describe('isSameServerEndpoint', () => {
  it('matches the same backend and url whatever the name', () => {
    expect(isSameServerEndpoint(HOME, { ...HOME, name: 'Renamed' })).toBe(true)
  })

  it('tells apart a different backend or url', () => {
    expect(isSameServerEndpoint(HOME, { ...HOME, backend: 'esplora' })).toBe(
      false
    )
    expect(
      isSameServerEndpoint(HOME, { ...HOME, url: 'tcp://other.local:50001' })
    ).toBe(false)
  })
})

describe('isSameServer', () => {
  it('matches the same saved entry', () => {
    expect(isSameServer(HOME, { ...HOME })).toBe(true)
  })

  it('tells apart the same endpoint saved under another name', () => {
    expect(isSameServer(HOME, { ...HOME, name: 'Renamed' })).toBe(false)
  })
})
