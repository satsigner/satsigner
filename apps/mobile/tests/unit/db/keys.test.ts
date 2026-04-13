import {
  accountKeys,
  addressKeys,
  labelKeys,
  nostrKeys,
  tagKeys,
  transactionKeys,
  utxoKeys
} from '@/db/keys'

describe('tanStack Query key factories', () => {
  describe('accountKeys', () => {
    it('returns stable all key', () => {
      expect(accountKeys.all).toStrictEqual(['accounts'])
    })

    it('returns detail key with id', () => {
      expect(accountKeys.detail('acc-1')).toStrictEqual(['accounts', 'acc-1'])
    })
  })

  describe('transactionKeys', () => {
    it('returns all key scoped to account', () => {
      expect(transactionKeys.all('acc-1')).toStrictEqual([
        'transactions',
        'acc-1'
      ])
    })

    it('returns detail key with account and txid', () => {
      expect(transactionKeys.detail('acc-1', 'tx-abc')).toStrictEqual([
        'transactions',
        'acc-1',
        'tx-abc'
      ])
    })
  })

  describe('utxoKeys', () => {
    it('returns all key scoped to account', () => {
      expect(utxoKeys.all('acc-1')).toStrictEqual(['utxos', 'acc-1'])
    })
  })

  describe('addressKeys', () => {
    it('returns all key scoped to account', () => {
      expect(addressKeys.all('acc-1')).toStrictEqual(['addresses', 'acc-1'])
    })

    it('returns detail key with account and address', () => {
      expect(addressKeys.detail('acc-1', 'bc1qabc')).toStrictEqual([
        'addresses',
        'acc-1',
        'bc1qabc'
      ])
    })
  })

  describe('labelKeys', () => {
    it('returns all key scoped to account', () => {
      expect(labelKeys.all('acc-1')).toStrictEqual(['labels', 'acc-1'])
    })
  })

  describe('tagKeys', () => {
    it('returns stable all key', () => {
      expect(tagKeys.all).toStrictEqual(['tags'])
    })
  })

  describe('nostrKeys', () => {
    it('returns dms key scoped to account', () => {
      expect(nostrKeys.dms('acc-1')).toStrictEqual(['nostr', 'dms', 'acc-1'])
    })

    it('returns relays key scoped to account', () => {
      expect(nostrKeys.relays('acc-1')).toStrictEqual([
        'nostr',
        'relays',
        'acc-1'
      ])
    })

    it('returns trustedDevices key scoped to account', () => {
      expect(nostrKeys.trustedDevices('acc-1')).toStrictEqual([
        'nostr',
        'devices',
        'acc-1'
      ])
    })
  })
})
