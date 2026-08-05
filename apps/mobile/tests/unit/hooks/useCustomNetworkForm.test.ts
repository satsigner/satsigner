import {
  defaultElectrumPorts,
  parseCustomBackendPaste
} from '@/hooks/useCustomNetworkForm'

describe('defaultElectrumPorts', () => {
  it('uses mainnet 50001/50002', () => {
    expect(defaultElectrumPorts('bitcoin')).toStrictEqual({
      ssl: 50002,
      tcp: 50001
    })
  })

  it('uses signet 60001/60002', () => {
    expect(defaultElectrumPorts('signet')).toStrictEqual({
      ssl: 60002,
      tcp: 60001
    })
  })

  it('uses testnet 51001/51002', () => {
    expect(defaultElectrumPorts('testnet')).toStrictEqual({
      ssl: 51002,
      tcp: 51001
    })
  })
})

describe('parseCustomBackendPaste', () => {
  it('accepts bare IPv4 as host (paste under host field)', () => {
    expect(parseCustomBackendPaste('192.168.0.144')).toStrictEqual({
      host: '192.168.0.144'
    })
  })

  it('accepts bare domain as host', () => {
    expect(parseCustomBackendPaste('electrum.blockstream.info')).toStrictEqual({
      host: 'electrum.blockstream.info'
    })
  })

  it('trims whitespace and quotes around bare IP', () => {
    expect(parseCustomBackendPaste('  "192.168.68.100"  ')).toStrictEqual({
      host: '192.168.68.100'
    })
  })

  it('parses electrum URL with IP host', () => {
    expect(parseCustomBackendPaste('ssl://192.168.0.144:50002')).toStrictEqual({
      backend: 'electrum',
      host: '192.168.0.144',
      port: '50002',
      protocol: 'ssl'
    })
  })

  it('parses host:port IP shorthand as electrum', () => {
    expect(parseCustomBackendPaste('192.168.0.144:50002')).toStrictEqual({
      backend: 'electrum',
      host: '192.168.0.144',
      port: '50002',
      protocol: 'ssl'
    })
  })

  it('parses https esplora URL with IP host', () => {
    expect(parseCustomBackendPaste('https://192.168.0.144:3000')).toStrictEqual(
      {
        backend: 'esplora',
        host: '192.168.0.144',
        port: '3000'
      }
    )
  })

  it('parses http RPC URL with IP host', () => {
    expect(parseCustomBackendPaste('http://192.168.1.50:8332')).toStrictEqual({
      backend: 'rpc',
      host: '192.168.1.50',
      port: '8332',
      rpcPassword: undefined,
      rpcUsername: undefined
    })
  })

  it('rejects empty and garbage input', () => {
    expect(parseCustomBackendPaste('')).toBeNull()
    expect(parseCustomBackendPaste('not a host')).toBeNull()
    expect(parseCustomBackendPaste('999.999.999.999')).toBeNull()
  })
})
