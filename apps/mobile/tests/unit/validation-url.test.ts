import {
  isValidDomainName,
  isValidIPAddress,
  isValidPort,
  isValidProtocol,
  validateElectrumUrl,
  validateEsploraUrl
} from '@/utils/validation/url'

describe('urlValidation', () => {
  describe('isValidDomainName', () => {
    it('should return true for valid domain names', () => {
      expect(isValidDomainName('example.com')).toBe(true)
      expect(isValidDomainName('sub.example.com')).toBe(true)
      expect(isValidDomainName('api.example.co.uk')).toBe(true)
      expect(isValidDomainName('test-123.example.com')).toBe(true)
      expect(isValidDomainName('a.b')).toBe(true)
    })

    it('should return false for invalid domain names', () => {
      expect(isValidDomainName('')).toBe(false)
      expect(isValidDomainName('192.168.1.1')).toBe(false)
      expect(isValidDomainName('.example.com')).toBe(false)
      expect(isValidDomainName('example.com.')).toBe(false)
      expect(isValidDomainName('example..com')).toBe(false)
      expect(isValidDomainName('-example.com')).toBe(false)
      expect(isValidDomainName('example-.com')).toBe(false)
    })
  })

  describe('isValidIPAddress', () => {
    it('should return true for valid IP addresses', () => {
      expect(isValidIPAddress('192.168.1.1')).toBe(true)
      expect(isValidIPAddress('127.0.0.1')).toBe(true)
      expect(isValidIPAddress('0.0.0.0')).toBe(true)
      expect(isValidIPAddress('255.255.255.255')).toBe(true)
      expect(isValidIPAddress('10.0.0.1')).toBe(true)
    })

    it('should return false for invalid IP addresses', () => {
      expect(isValidIPAddress('')).toBe(false)
      expect(isValidIPAddress('example.com')).toBe(false)
      expect(isValidIPAddress('256.1.1.1')).toBe(false)
      expect(isValidIPAddress('192.168.1')).toBe(false)
      expect(isValidIPAddress('192.168.1.1.1')).toBe(false)
      expect(isValidIPAddress('192.168.1.-1')).toBe(false)
    })
  })

  describe('isValidPort', () => {
    it('should return true for valid ports', () => {
      expect(isValidPort('80')).toBe(true)
      expect(isValidPort('443')).toBe(true)
      expect(isValidPort('50001')).toBe(true)
      expect(isValidPort('65535')).toBe(true)
      expect(isValidPort('0')).toBe(true)
    })

    it('should return false for invalid ports', () => {
      expect(isValidPort('')).toBe(false)
      expect(isValidPort('abc')).toBe(false)
      expect(isValidPort('80a')).toBe(false)
      expect(isValidPort('80.5')).toBe(false)
      expect(isValidPort('-80')).toBe(false)
    })
  })

  describe('isValidProtocol', () => {
    it('should return true for valid protocols', () => {
      expect(isValidProtocol('tcp')).toBe(true)
      expect(isValidProtocol('ssl')).toBe(true)
      expect(isValidProtocol('tls')).toBe(true)
    })

    it('should return false for invalid protocols', () => {
      expect(isValidProtocol('http')).toBe(false)
      expect(isValidProtocol('https')).toBe(false)
      expect(isValidProtocol('')).toBe(false)
      expect(isValidProtocol('ws')).toBe(false)
    })
  })

  describe('validateElectrumUrl', () => {
    it('should return valid for correct Electrum URLs', () => {
      expect(validateElectrumUrl('ssl://electrum.example.com:50002')).toEqual({
        isValid: true
      })
      expect(validateElectrumUrl('tcp://192.168.1.1:50001')).toEqual({
        isValid: true
      })
      expect(validateElectrumUrl('tls://api.electrum.com:50002')).toEqual({
        isValid: true
      })
    })

    it('should return invalid for incorrect Electrum URLs', () => {
      expect(validateElectrumUrl('http://example.com:80')).toEqual({
        isValid: false,
        error: 'Invalid protocol. Must be tcp, ssl, or tls'
      })
      expect(validateElectrumUrl('ssl://.example.com:50002')).toEqual({
        isValid: false,
        error: 'Invalid host. Must be a valid domain name or IP address'
      })
      expect(validateElectrumUrl('ssl://example.com:abc')).toEqual({
        isValid: false,
        error: 'Invalid port. Must be a valid number'
      })
      expect(validateElectrumUrl('invalid-url')).toEqual({
        isValid: false,
        error: 'Invalid URL format'
      })
    })
  })

  describe('validateEsploraUrl', () => {
    it('should return valid for correct Esplora URLs', () => {
      expect(validateEsploraUrl('https://mempool.space/api')).toEqual({
        isValid: true
      })
      expect(validateEsploraUrl('https://api.example.com:443/api')).toEqual({
        isValid: true
      })
    })

    it('should return invalid for incorrect Esplora URLs', () => {
      expect(validateEsploraUrl('http://example.com/api')).toEqual({
        isValid: false,
        error: 'Invalid URL. Esplora URLs must use HTTPS protocol'
      })
      expect(validateEsploraUrl('ssl://example.com/api')).toEqual({
        isValid: false,
        error: 'Invalid URL. Esplora URLs must use HTTPS protocol'
      })
      expect(validateEsploraUrl('not-a-url')).toEqual({
        isValid: false,
        error: 'Invalid URL. Esplora URLs must use HTTPS protocol'
      })
    })
  })
})
