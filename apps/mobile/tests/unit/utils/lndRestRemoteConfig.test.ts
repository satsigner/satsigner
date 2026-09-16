import {
  getLndConfigFileUrlFromConnectionInput,
  macaroonToLndRestHexHeader,
  normalizeLndRestBaseUrl,
  parseLndConnectUri,
  parseLndConnectionInput,
  parseLndRemotePairingConnectionString,
  parseLndRemotePairingFromJsonText,
  parseLndRemotePairingPayload,
  restBaseUrlFromPairingUri
} from '@/utils/lndRestRemoteConfig'

describe('lndRestRemoteConfig', () => {
  describe('getLndConfigFileUrlFromConnectionInput', () => {
    it('strips config= prefix', () => {
      expect(
        getLndConfigFileUrlFromConnectionInput(
          'config=https://h.example/path/lnd.config'
        )
      ).toBe('https://h.example/path/lnd.config')
    })

    it('accepts bare https URL ending in .config', () => {
      expect(
        getLndConfigFileUrlFromConnectionInput(
          'https://h.example/path/lnd.config'
        )
      ).toBe('https://h.example/path/lnd.config')
    })

    it('uses first line when pasted with trailing note', () => {
      expect(
        getLndConfigFileUrlFromConnectionInput(
          'https://h.example/x.config\nextra line'
        )
      ).toBe('https://h.example/x.config')
    })

    it('returns null for URL without .config segment', () => {
      expect(
        getLndConfigFileUrlFromConnectionInput('https://h.example/rest/v1/')
      ).toBeNull()
    })
  })

  describe('parseLndConnectUri', () => {
    it('parses onion host, port, base64url macaroon, and cert', () => {
      const macHex = 'cafebabe'
      const macB64Url = Buffer.from(macHex, 'hex')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
      const uri =
        'lndconnect://abcdefghijklmnopqrstuvwxyz012345abcdefghijklmnop.onion:8080' +
        `?cert=LS0tLS1CRUdJTi&macaroon=${macB64Url}`
      const cfg = parseLndConnectUri(uri)
      expect(cfg.url).toBe(
        'https://abcdefghijklmnopqrstuvwxyz012345abcdefghijklmnop.onion:8080'
      )
      expect(cfg.macaroon).toBe(macHex)
      expect(cfg.cert).toBe('LS0tLS1CRUdJTi')
    })

    it('ignores whitespace inside a pasted URI', () => {
      const macHex = '0102'
      const macB64 = Buffer.from(macHex, 'hex').toString('base64')
      const uri = `lndconnect://node.example:8080?macaroon=${macB64}`
      const wrapped = `${uri.slice(0, 20)}\n${uri.slice(20)}`
      expect(parseLndConnectUri(wrapped).macaroon).toBe(macHex)
    })

    it('keeps plus signs in standard base64 query values', () => {
      const macHex = 'fb00'
      const macB64 = Buffer.from(macHex, 'hex').toString('base64')
      expect(macB64).toContain('+')
      const uri = `lndconnect://node.example:8080?macaroon=${macB64}`
      expect(parseLndConnectUri(uri).macaroon).toBe(macHex)
    })

    it('rejects lndconnect without a macaroon', () => {
      expect(() =>
        parseLndConnectUri(
          'lndconnect://abcdefghijklmnopqrstuvwxyz012345abcdefghijklmnop.onion:8080?cert=LS0t'
        )
      ).toThrow('lndconnect URI missing macaroon')
    })
  })

  describe('parseLndConnectionInput', () => {
    it('accepts lndconnect as inline config', () => {
      const macB64 = Buffer.from('aa', 'hex').toString('base64')
      const parsed = parseLndConnectionInput(
        `lndconnect://h.onion:8080?macaroon=${macB64}`
      )
      expect(parsed).toStrictEqual({
        config: expect.objectContaining({
          url: 'https://h.onion:8080'
        }),
        kind: 'inline'
      })
    })

    it('accepts a .config file URL as remote fetch', () => {
      const parsed = parseLndConnectionInput(
        'config=https://h.example/path/lnd.config'
      )
      expect(parsed).toStrictEqual({
        kind: 'remoteConfigUrl',
        url: 'https://h.example/path/lnd.config'
      })
    })

    it('accepts pasted BTCPay configurations JSON', () => {
      const json = JSON.stringify({
        configurations: [
          {
            adminMacaroon: 'aabb',
            chainType: 'Mainnet',
            cryptoCode: 'BTC',
            macaroon: 'cafebabe',
            type: 'lnd-rest',
            uri: 'https://example.com/lnd-rest/btc/'
          }
        ]
      })
      const parsed = parseLndConnectionInput(json)
      expect(parsed).toStrictEqual({
        config: expect.objectContaining({
          macaroon: 'cafebabe',
          url: 'https://example.com/lnd-rest/btc'
        }),
        kind: 'inline'
      })
    })

    it('rewrites BTCPay lnd-grpc JSON to the REST URI', () => {
      const json = JSON.stringify({
        configurations: [
          {
            macaroon: 'cafebabe',
            type: 'lnd-grpc',
            uri: 'https://example.com/lnd-grpc/btc/'
          }
        ]
      })
      const parsed = parseLndConnectionInput(json)
      expect(parsed).toStrictEqual({
        config: expect.objectContaining({
          url: 'https://example.com/lnd-rest/btc'
        }),
        kind: 'inline'
      })
    })

    it('rejects Core Lightning RPC JSON', () => {
      const json = JSON.stringify({
        configurations: [
          {
            macaroon: 'aa',
            type: 'clightning-rpc',
            uri: 'https://example.com/lightningrpc'
          }
        ]
      })
      expect(parseLndConnectionInput(json)).toBeNull()
    })
  })

  describe('restBaseUrlFromPairingUri', () => {
    it('maps gRPC listen port to REST', () => {
      expect(restBaseUrlFromPairingUri('https://lnd.example:10009')).toBe(
        'https://lnd.example:8080'
      )
    })

    it('maps grpcs scheme to https', () => {
      expect(restBaseUrlFromPairingUri('grpcs://lnd.example:10009')).toBe(
        'https://lnd.example:8080'
      )
    })
  })

  describe('normalizeLndRestBaseUrl', () => {
    it('strips trailing slashes', () => {
      expect(normalizeLndRestBaseUrl('https://node.example:8080/')).toBe(
        'https://node.example:8080'
      )
    })
  })

  describe('macaroonToLndRestHexHeader', () => {
    it('passes through lowercase hex', () => {
      const hex = 'aabbccdd'
      expect(macaroonToLndRestHexHeader(hex)).toBe('aabbccdd')
    })

    it('decodes standard base64 to hex', () => {
      const b64 = Buffer.from('deadbeef', 'hex').toString('base64')
      expect(macaroonToLndRestHexHeader(b64)).toBe('deadbeef')
    })

    it('decodes base64url to hex', () => {
      const buf = Buffer.from('0102030405', 'hex')
      const url = buf
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
      expect(macaroonToLndRestHexHeader(url)).toBe('0102030405')
    })
  })

  describe('parseLndRemotePairingFromJsonText', () => {
    it('parses configurations[0] with uri and hex macaroon', () => {
      const json = JSON.stringify({
        configurations: [
          {
            cert: 'MIIB',
            macaroon: 'aabbcc',
            uri: 'https://lnd.example/v1/'
          }
        ]
      })
      const cfg = parseLndRemotePairingFromJsonText(json)
      expect(cfg.url).toBe('https://lnd.example/v1')
      expect(cfg.macaroon).toBe('aabbcc')
      expect(cfg.cert).toBe('MIIB')
    })

    it('parses flat JSON with url and base64 macaroon', () => {
      const macHex = 'cafebabe'
      const b64 = Buffer.from(macHex, 'hex').toString('base64')
      const json = JSON.stringify({
        cert: '',
        macaroon: b64,
        url: 'https://rest.example/'
      })
      const cfg = parseLndRemotePairingFromJsonText(json)
      expect(cfg.url).toBe('https://rest.example')
      expect(cfg.macaroon).toBe(macHex)
    })

    it('parses root-level JSON array', () => {
      const json = JSON.stringify([
        { macaroon: 'ab01', restUrl: 'https://x.dev/tor/' }
      ])
      const cfg = parseLndRemotePairingFromJsonText(json)
      expect(cfg.url).toBe('https://x.dev/tor')
      expect(cfg.macaroon).toBe('ab01')
    })
  })

  describe('parseLndRemotePairingConnectionString', () => {
    it('parses type=lnd-rest BTCPay-style string', () => {
      const macHex = '0102'
      const b64 = Buffer.from(macHex, 'hex').toString('base64')
      const line = `type=lnd-rest;server=https://btcpay.local:8080/;macaroon=${b64}`
      const cfg = parseLndRemotePairingConnectionString(line)
      expect(cfg.url).toBe('https://btcpay.local:8080')
      expect(cfg.macaroon).toBe(macHex)
    })

    it('parses type=lnd-grpc and rewrites the path', () => {
      const macHex = '0102'
      const b64 = Buffer.from(macHex, 'hex').toString('base64')
      const line = `type=lnd-grpc;server=https://btcpay.local/lnd-grpc/btc/;macaroon=${b64}`
      const cfg = parseLndRemotePairingConnectionString(line)
      expect(cfg.url).toBe('https://btcpay.local/lnd-rest/btc')
      expect(cfg.macaroon).toBe(macHex)
    })
  })

  describe('parseLndRemotePairingPayload', () => {
    it('dispatches JSON', () => {
      const json = JSON.stringify({
        configurations: [{ macaroon: 'aa', uri: 'https://u/' }]
      })
      const cfg = parseLndRemotePairingPayload(json)
      expect(cfg.macaroon).toBe('aa')
    })

    it('dispatches connection string when type=lnd-rest present', () => {
      const macHex = '9900'
      const b64 = Buffer.from(macHex, 'hex').toString('base64')
      const s = `type=lnd-rest;server=https://h/;macaroon=${b64}`
      const cfg = parseLndRemotePairingPayload(s)
      expect(cfg.macaroon).toBe('9900')
    })
  })
})
