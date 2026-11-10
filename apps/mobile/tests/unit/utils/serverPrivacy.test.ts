import {
  getNewlySelectedPublicServers,
  getRestoredPublicServer,
  getServerPrivacy,
  isNewlyPublic,
  isOnionUrl
} from '@/utils/serverPrivacy'

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
    `ssl://electrum.${ONION_HOST}:50002`,
    `ssl://my_node.${ONION_HOST}:50002`,
    `https://${ONION_HOST}?x=1`,
    `https://${ONION_HOST}#top`,
    `https://${ONION_HOST}./api`,
    `http://user:p@ss@${ONION_HOST}/api`,
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

describe('getNewlySelectedPublicServers', () => {
  const myNode = {
    backend: 'electrum' as const,
    isPrivate: true,
    name: 'Umbrel',
    network: 'bitcoin' as const,
    url: 'tcp://umbrel.local:50001'
  }
  const mempool = {
    backend: 'esplora' as const,
    name: 'Mempool',
    network: 'bitcoin' as const,
    url: 'https://mempool.space/api'
  }
  const signetMempool = {
    backend: 'electrum' as const,
    name: 'Mempool',
    network: 'signet' as const,
    url: 'ssl://mempool.space:60602'
  }

  it('returns a public server the user just switched to', () => {
    expect(
      getNewlySelectedPublicServers(
        { bitcoin: myNode, signet: signetMempool },
        { bitcoin: mempool, signet: signetMempool }
      )
    ).toStrictEqual([mempool])
  })

  it('ignores public servers that were already selected', () => {
    expect(
      getNewlySelectedPublicServers(
        { bitcoin: mempool, signet: signetMempool },
        { bitcoin: mempool, signet: signetMempool }
      )
    ).toStrictEqual([])
  })

  it('ignores a renamed copy of the server already selected', () => {
    expect(
      getNewlySelectedPublicServers(
        { bitcoin: mempool },
        { bitcoin: { ...mempool, name: 'My mempool' } }
      )
    ).toStrictEqual([])
  })

  it('ignores a switch to a private server', () => {
    expect(
      getNewlySelectedPublicServers({ bitcoin: mempool }, { bitcoin: myNode })
    ).toStrictEqual([])
  })
})

describe('getRestoredPublicServer', () => {
  const myNode = {
    backend: 'electrum' as const,
    isPrivate: true,
    name: 'Umbrel',
    network: 'bitcoin' as const,
    url: 'tcp://umbrel.local:50001'
  }
  const mempool = {
    backend: 'esplora' as const,
    name: 'Mempool',
    network: 'bitcoin' as const,
    url: 'https://mempool.space/api'
  }

  it('flags a public server the backup switched to', () => {
    expect(getRestoredPublicServer(myNode, mempool)).toBe(mempool)
  })

  it('stays quiet when the backup keeps the server already in use', () => {
    expect(
      getRestoredPublicServer(mempool, { ...mempool, name: 'Default bitcoin' })
    ).toBeUndefined()
  })

  it('stays quiet for a private server', () => {
    expect(getRestoredPublicServer(mempool, myNode)).toBeUndefined()
  })
})

describe('isNewlyPublic', () => {
  const mempool = {
    backend: 'esplora' as const,
    name: 'Mempool',
    network: 'bitcoin' as const,
    url: 'https://mempool.space/api'
  }
  const myElectrum = {
    backend: 'electrum' as const,
    name: 'My Electrum',
    network: 'bitcoin' as const,
    url: 'ssl://electrum.example:50002'
  }

  it('flags a public endpoint the app was not using', () => {
    expect(isNewlyPublic(mempool, myElectrum)).toBe(true)
  })

  it('ignores a rename of the active public endpoint', () => {
    expect(isNewlyPublic(myElectrum, { ...myElectrum, name: 'Renamed' })).toBe(
      false
    )
  })

  it('ignores a switch to a server marked private', () => {
    expect(isNewlyPublic(mempool, { ...myElectrum, isPrivate: true })).toBe(
      false
    )
  })
})
