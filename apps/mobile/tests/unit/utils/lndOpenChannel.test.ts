import { LND_OPEN_CHANNEL_MIN_FUNDING_SAT } from '@/constants/lightning'
import {
  buildLndOpenChannelBody,
  formatLndPeerUri,
  isLndAlreadyConnectedError,
  openChannelWithPeer,
  parseLndPeerUri,
  parseOptionalSatPerVbyte,
  peerUriFromScannedText,
  validateLndOpenChannelInput
} from '@/utils/lndOpenChannel'

const PUBKEY = `02${'ab'.repeat(32)}`

describe('lndOpenChannel', () => {
  describe('parseLndPeerUri', () => {
    it('parses a compressed pubkey', () => {
      expect(parseLndPeerUri(`  ${PUBKEY}  `)).toStrictEqual({ pubkey: PUBKEY })
    })

    it('parses a lightning: URI prefix', () => {
      expect(
        parseLndPeerUri(`lightning:${PUBKEY}@node.example:9735`)
      ).toStrictEqual({
        host: 'node.example:9735',
        pubkey: PUBKEY
      })
    })

    it('parses an ln:// URI prefix', () => {
      expect(
        parseLndPeerUri(`ln://${PUBKEY}@199.84.252.119:9735`)
      ).toStrictEqual({
        host: '199.84.252.119:9735',
        pubkey: PUBKEY
      })
    })

    it('parses IPv6 host after the first @', () => {
      expect(parseLndPeerUri(`${PUBKEY}@[::1]:9735`)).toStrictEqual({
        host: '[::1]:9735',
        pubkey: PUBKEY
      })
    })

    it('returns null for empty, short, or host-only input', () => {
      expect(parseLndPeerUri('')).toBeNull()
      expect(parseLndPeerUri('02aa')).toBeNull()
      expect(parseLndPeerUri(`${PUBKEY}@`)).toBeNull()
    })
  })

  describe('peerUriFromScannedText', () => {
    it('returns pubkey@host from a scanned lightning URI', () => {
      expect(peerUriFromScannedText(`lightning:${PUBKEY}@1.2.3.4:9735`)).toBe(
        `${PUBKEY}@1.2.3.4:9735`
      )
    })

    it('returns pubkey@host from a bare node URI QR', () => {
      expect(peerUriFromScannedText(`${PUBKEY}@199.84.252.119:9735`)).toBe(
        `${PUBKEY}@199.84.252.119:9735`
      )
    })

    it('returns null for unrelated QR content', () => {
      expect(peerUriFromScannedText('lnbc1invoice')).toBeNull()
    })
  })

  describe('formatLndPeerUri', () => {
    it('joins pubkey and address', () => {
      expect(
        formatLndPeerUri({ address: '1.2.3.4:9735', pub_key: PUBKEY })
      ).toBe(`${PUBKEY}@1.2.3.4:9735`)
    })

    it('returns pubkey when address is missing', () => {
      expect(formatLndPeerUri({ pub_key: PUBKEY })).toBe(PUBKEY)
    })
  })

  describe('isLndAlreadyConnectedError', () => {
    it('matches LND already-connected messages', () => {
      expect(
        isLndAlreadyConnectedError(
          new Error('LND API error: 500 already connected to peer')
        )
      ).toBe(true)
      expect(isLndAlreadyConnectedError(new Error('timeout'))).toBe(false)
    })
  })

  describe('buildLndOpenChannelBody', () => {
    it('omits sat_per_vbyte when unset', () => {
      expect(
        buildLndOpenChannelBody(PUBKEY, {
          localFundingSat: 100_000,
          minConfs: 1,
          privateChannel: true,
          pushSat: 1_000
        })
      ).toStrictEqual({
        local_funding_amount: '100000',
        min_confs: 1,
        node_pubkey_string: PUBKEY,
        private: true,
        push_sat: '1000'
      })
    })

    it('includes sat_per_vbyte when set', () => {
      expect(
        buildLndOpenChannelBody(PUBKEY, {
          localFundingSat: 100_000,
          minConfs: 2,
          privateChannel: false,
          pushSat: 0,
          satPerVbyte: 4
        }).sat_per_vbyte
      ).toBe('4')
    })
  })

  describe('validateLndOpenChannelInput', () => {
    const base = {
      confirmedSat: 200_000,
      localFundingSat: 100_000,
      minConfs: 1,
      peerText: PUBKEY,
      pushSat: 0,
      satPerVbyteText: ''
    }

    it('accepts a valid pubkey and amount', () => {
      expect(validateLndOpenChannelInput(base)).toStrictEqual({
        ok: true,
        peer: { pubkey: PUBKEY }
      })
    })

    it('rejects a bad peer', () => {
      expect(
        validateLndOpenChannelInput({ ...base, peerText: 'nope' })
      ).toStrictEqual({ ok: false, reason: 'peer' })
    })

    it('rejects amount below min channel size', () => {
      expect(
        validateLndOpenChannelInput({
          ...base,
          localFundingSat: LND_OPEN_CHANNEL_MIN_FUNDING_SAT - 1
        })
      ).toStrictEqual({ ok: false, reason: 'amount' })
    })

    it('rejects amount above confirmed balance', () => {
      expect(
        validateLndOpenChannelInput({
          ...base,
          confirmedSat: 50_000,
          localFundingSat: 100_000
        })
      ).toStrictEqual({ ok: false, reason: 'balance' })
    })

    it('rejects push above local amount', () => {
      expect(
        validateLndOpenChannelInput({ ...base, pushSat: 100_001 })
      ).toStrictEqual({ ok: false, reason: 'push' })
    })

    it('rejects invalid fee text', () => {
      expect(
        validateLndOpenChannelInput({ ...base, satPerVbyteText: '0' })
      ).toStrictEqual({ ok: false, reason: 'fee' })
    })
  })

  describe('parseOptionalSatPerVbyte', () => {
    it('returns undefined for blank text', () => {
      expect(parseOptionalSatPerVbyte('  ')).toBeUndefined()
    })

    it('parses a positive fee', () => {
      expect(parseOptionalSatPerVbyte('3')).toBe(3)
    })
  })

  describe('openChannelWithPeer', () => {
    it('skips connect when host is missing', async () => {
      const connectPeer = jest.fn()
      const openChannel = jest.fn().mockResolvedValue({
        funding_txid_str: 'abc',
        output_index: 0
      })
      await openChannelWithPeer(
        { pubkey: PUBKEY },
        {
          localFundingSat: 100_000,
          minConfs: 1,
          privateChannel: false,
          pushSat: 0
        },
        { connectPeer, openChannel }
      )
      expect(connectPeer).not.toHaveBeenCalled()
      expect(openChannel).toHaveBeenCalledTimes(1)
    })

    it('connects then opens when host is present', async () => {
      const connectPeer = jest.fn().mockResolvedValue({})
      const openChannel = jest.fn().mockResolvedValue({})
      await openChannelWithPeer(
        { host: '1.2.3.4:9735', pubkey: PUBKEY },
        {
          localFundingSat: 100_000,
          minConfs: 1,
          privateChannel: false,
          pushSat: 0
        },
        { connectPeer, openChannel }
      )
      expect(connectPeer).toHaveBeenCalledWith({
        host: '1.2.3.4:9735',
        pubkey: PUBKEY
      })
      expect(openChannel).toHaveBeenCalledTimes(1)
    })

    it('treats already-connected as success and still opens', async () => {
      const connectPeer = jest
        .fn()
        .mockRejectedValue(new Error('already connected to peer'))
      const openChannel = jest.fn().mockResolvedValue({})
      await openChannelWithPeer(
        { host: '1.2.3.4:9735', pubkey: PUBKEY },
        {
          localFundingSat: 100_000,
          minConfs: 1,
          privateChannel: false,
          pushSat: 0
        },
        { connectPeer, openChannel }
      )
      expect(openChannel).toHaveBeenCalledTimes(1)
    })

    it('rethrows other connect errors', async () => {
      const connectPeer = jest.fn().mockRejectedValue(new Error('timeout'))
      const openChannel = jest.fn()
      await expect(
        openChannelWithPeer(
          { host: '1.2.3.4:9735', pubkey: PUBKEY },
          {
            localFundingSat: 100_000,
            minConfs: 1,
            privateChannel: false,
            pushSat: 0
          },
          { connectPeer, openChannel }
        )
      ).rejects.toThrow('timeout')
      expect(openChannel).not.toHaveBeenCalled()
    })
  })
})
