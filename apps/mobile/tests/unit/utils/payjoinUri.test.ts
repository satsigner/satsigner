import {
  appendParamsToPayjoinUri,
  buildPayjoinUri,
  detectEndpointKind,
  hasPayjoinParam,
  normalizeBip77FragmentDelimiters,
  parsePayjoinUri
} from '@/utils/payjoinUri'

/** Sanitized Bull-style BIP77 receive URI (placeholder mailbox + fragment). */
const BULL_STYLE_RECEIVE_URI =
  'bitcoin:tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx?amount=0.0001&pjos=0&pj=https://payjo.in/abc123def#RK1-legacy+sep-OH1-mock'

const BULL_STYLE_FINAL_BIP77_URI =
  'bitcoin:tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx?amount=0.0001&pjos=0&pj=https://payjo.in/abc123def#EX1-600-OH1-mock-RK1-mock'

describe('payjoinUri', () => {
  describe('parsePayjoinUri', () => {
    it('parses Bull-style URI with + fragment delimiter', () => {
      const result = parsePayjoinUri(BULL_STYLE_RECEIVE_URI)
      expect(result.isValid).toBe(true)
      expect(result.params?.address).toBe(
        'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
      )
      expect(result.params?.amountBtc).toBe(0.0001)
      expect(result.params?.pjos).toBe(0)
      expect(result.params?.pj).toContain('https://payjo.in/')
      expect(result.params?.pj).toContain('://')
      expect(result.endpointKind).toBe('bip77')
    })

    it('parses final BIP77 URI with - fragment delimiter', () => {
      const result = parsePayjoinUri(BULL_STYLE_FINAL_BIP77_URI)
      expect(result.isValid).toBe(true)
      expect(result.endpointKind).toBe('bip77')
      expect(result.params?.pj.includes('#')).toBe(true)
    })

    it('parses BIP78 HTTPS endpoint without fragment as bip78', () => {
      const uri =
        'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.001&pj=https://example.com/payjoin'
      const result = parsePayjoinUri(uri)
      expect(result.isValid).toBe(true)
      expect(result.endpointKind).toBe('bip78')
      expect(result.params?.pj).toBe('https://example.com/payjoin')
    })

    it('rejects URI without pj', () => {
      const result = parsePayjoinUri(
        'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.001'
      )
      expect(result.isValid).toBe(false)
    })

    it('decodes percent-encoded pj without breaking ://', () => {
      const encoded =
        'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?pj=https%3A%2F%2Fexample.com%2Fpj'
      const result = parsePayjoinUri(encoded)
      expect(result.isValid).toBe(true)
      expect(result.params?.pj).toBe('https://example.com/pj')
    })
  })

  describe('buildPayjoinUri', () => {
    it('keeps pj :// intact and pj last', () => {
      const uri = buildPayjoinUri({
        address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        amountSats: 10_000,
        label: 'test',
        pjEndpoint: 'https://payjo.in/mb#RK1-mock',
        pjos: 0
      })
      expect(uri).toContain('pj=https://payjo.in/mb%23RK1-mock')
      expect(uri).not.toContain('HTTPS%3A')
      expect(uri.indexOf('pj=')).toBeGreaterThan(uri.indexOf('amount='))
      expect(uri).toContain('pjos=0')
      expect(uri).toContain('label=test')
    })

    it('round-trips through parse', () => {
      const uri = buildPayjoinUri({
        address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        amountSats: 50_000,
        pjEndpoint: 'https://payjo.in/xyz#EX1-600-OH1-a',
        pjos: 0
      })
      const parsed = parsePayjoinUri(uri)
      expect(parsed.isValid).toBe(true)
      expect(parsed.params?.pj).toBe('https://payjo.in/xyz#EX1-600-OH1-a')
      expect(parsed.params?.amountBtc).toBeCloseTo(0.0005)
    })
  })

  describe('appendParamsToPayjoinUri', () => {
    it('appends amount without re-encoding pj ://', () => {
      const pdkUri =
        'bitcoin:tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx?pjos=0&pj=https://payjo.in/mb#RK1-x'
      const withAmount = appendParamsToPayjoinUri(pdkUri, {
        amountSats: 21_000,
        label: 'invoice'
      })
      expect(withAmount).toContain('pj=https://payjo.in/mb%23RK1-x')
      expect(withAmount).toContain('amount=0.00021')
      expect(withAmount).toContain('label=invoice')
    })

    it('accepts PDK uppercase HTTPS and %23 fragment encoding', () => {
      const pdkUri =
        'bitcoin:tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx?pjos=0&pj=HTTPS://PAYJO.IN/MB%23RK1-MOCK'
      const withAmount = appendParamsToPayjoinUri(pdkUri, {
        amountSats: 10_000
      })
      expect(withAmount.toLowerCase()).toContain('pj=https://payjo.in/mb%23rk1-mock')
      expect(withAmount).toContain('amount=0.0001')
      const parsed = parsePayjoinUri(withAmount)
      expect(parsed.isValid).toBe(true)
      expect(parsed.params?.pj).toBe('https://PAYJO.IN/MB#RK1-MOCK')
    })

    it('clears label when extras.label is explicitly undefined', () => {
      const withLabel =
        'bitcoin:tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx?label=invoice&pjos=0&pj=https://payjo.in/mb%23RK1-x'
      const cleared = appendParamsToPayjoinUri(withLabel, {
        label: undefined
      })
      expect(cleared).not.toContain('label=')
      expect(cleared).toContain('pj=https://payjo.in/mb%23RK1-x')
      expect(parsePayjoinUri(cleared).params?.label).toBeUndefined()
    })

    it('keeps prior label when label key is omitted', () => {
      const withLabel =
        'bitcoin:tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx?label=keep-me&pjos=0&pj=https://payjo.in/mb%23RK1-x'
      const withAmount = appendParamsToPayjoinUri(withLabel, {
        amountSats: 5_000
      })
      expect(withAmount).toContain('label=keep-me')
      expect(withAmount).toContain('amount=0.00005')
    })
  })

  describe('normalizeBip77FragmentDelimiters', () => {
    it('rewrites + to - in fragment', () => {
      const normalized = normalizeBip77FragmentDelimiters(
        'https://payjo.in/mb#RK1+a+b'
      )
      expect(normalized).toBe('https://payjo.in/mb#RK1-a-b')
    })
  })

  describe('hasPayjoinParam / detectEndpointKind', () => {
    it('detects payjoin presence', () => {
      expect(hasPayjoinParam(BULL_STYLE_FINAL_BIP77_URI)).toBe(true)
      expect(
        hasPayjoinParam('bitcoin:tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx')
      ).toBe(false)
    })

    it('classifies directory host as bip77', () => {
      expect(detectEndpointKind('https://payjo.in/abc')).toBe('bip77')
      expect(detectEndpointKind('https://btcpay.example/pj')).toBe('bip78')
    })
  })
})
