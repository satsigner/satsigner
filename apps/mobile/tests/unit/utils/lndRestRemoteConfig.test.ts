import {
  getLndConfigFileUrlFromConnectionInput,
  macaroonToLndRestHexHeader,
  normalizeLndRestBaseUrl,
  parseLndRemotePairingConnectionString,
  parseLndRemotePairingFromJsonText,
  parseLndRemotePairingPayload
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
