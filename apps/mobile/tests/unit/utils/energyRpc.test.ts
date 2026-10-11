import { ZodError } from 'zod'

import {
  parseBlockchainInfoResponse,
  parseBlockTemplateResponse,
  parseChainInfoResponse
} from '@/utils/energyRpc'

const coreBlockTemplate = {
  bits: '207fffff',
  capabilities: ['proposal'],
  coinbaseaux: {},
  coinbasevalue: 5_000_000_000,
  curtime: 1_700_000_000,
  default_witness_commitment:
    '6a24aa21a9ede2f61c3f71d1defd3fa999dfa36953755c690689799962b48bebd836974e8cf9',
  height: 101,
  longpollid: 'abc123',
  mintime: 1_699_999_000,
  mutable: ['time', 'transactions', 'prevblock'],
  noncerange: '00000000ffffffff',
  previousblockhash:
    '0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206',
  rules: ['csv', '!segwit', 'taproot'],
  sigoplimit: 80_000,
  sizelimit: 4_000_000,
  target: '7fffff0000000000000000000000000000000000000000000000000000000000',
  transactions: [
    {
      data: '0200000001abcdef',
      depends: [],
      fee: 1000,
      hash: 'aa'.repeat(32),
      sigops: 4,
      txid: 'bb'.repeat(32),
      weight: 561
    }
  ],
  vbavailable: {},
  vbrequired: 0,
  version: 536_870_912,
  weightlimit: 4_000_000
}

const coreBlockchainInfo = {
  bestblockhash:
    '0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206',
  bits: '207fffff',
  blocks: 100,
  chain: 'regtest',
  chainwork: '00000000000000000000000000000000000000000000000000000000000000ca',
  difficulty: 4.656542373906925e-10,
  headers: 100,
  initialblockdownload: false,
  mediantime: 1_699_999_000,
  pruned: false,
  size_on_disk: 30_000,
  target: '7fffff0000000000000000000000000000000000000000000000000000000000',
  time: 1_700_000_000,
  verificationprogress: 1,
  warnings: []
}

describe('energyRpc', () => {
  describe('parseBlockTemplateResponse', () => {
    it('accepts a Bitcoin Core template and keeps fields it does not check', () => {
      const data = parseBlockTemplateResponse({
        error: null,
        id: '1',
        result: coreBlockTemplate
      })

      expect(data.error).toBeNull()
      expect(data.result).toStrictEqual(coreBlockTemplate)
    })

    it('accepts an error response without a result', () => {
      const data = parseBlockTemplateResponse({
        error: { code: -32601, message: 'Method not found' },
        id: '1',
        result: null
      })

      expect(data.error).toStrictEqual({
        code: -32601,
        message: 'Method not found'
      })
      expect(data.result).toBeNull()
    })

    it('rejects a template missing a field needed for mining', () => {
      const { bits: _bits, ...template } = coreBlockTemplate

      expect(() =>
        parseBlockTemplateResponse({ error: null, result: template })
      ).toThrow(ZodError)
    })

    it('rejects a malformed error object', () => {
      expect(() =>
        parseBlockTemplateResponse({ error: 'boom', result: null })
      ).toThrow(ZodError)
    })
  })

  describe('parseBlockchainInfoResponse', () => {
    it('accepts a modern Bitcoin Core response without softforks', () => {
      const data = parseBlockchainInfoResponse({
        error: null,
        id: '1',
        result: coreBlockchainInfo
      })

      expect(data.result).toStrictEqual(coreBlockchainInfo)
    })

    it('rejects a response with a non-numeric block count', () => {
      expect(() =>
        parseBlockchainInfoResponse({
          error: null,
          result: { ...coreBlockchainInfo, blocks: '100' }
        })
      ).toThrow(ZodError)
    })
  })

  describe('parseChainInfoResponse', () => {
    it('only requires the chain name', () => {
      const data = parseChainInfoResponse({
        error: null,
        result: { chain: 'signet' }
      })

      expect(data.result?.chain).toBe('signet')
    })

    it('rejects a non-string chain name', () => {
      expect(() => parseChainInfoResponse({ result: { chain: 1 } })).toThrow(
        ZodError
      )
    })
  })
})
