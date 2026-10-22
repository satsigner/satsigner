import { t } from '@/locales'
import {
  getNfcErrorKey,
  NfcCancelledError,
  NfcDisabledError
} from '@/utils/nfcError'

describe('getNfcErrorKey', () => {
  it('returns null when the NFC session was cancelled', () => {
    expect(
      getNfcErrorKey(new NfcCancelledError(), 'nfc.error.writeFailed')
    ).toBeNull()
  })

  it('asks to turn NFC on when it is switched off', () => {
    expect(getNfcErrorKey(new NfcDisabledError(), 'nfc.error.readFailed')).toBe(
      'watchonly.read.nfcTurnOnInSettings'
    )
  })

  it('falls back to the given key for other failures', () => {
    expect(getNfcErrorKey(new Error('tag lost'), 'nfc.error.writeFailed')).toBe(
      'nfc.error.writeFailed'
    )
    expect(getNfcErrorKey('cancelled', 'nfc.error.readFailed')).toBe(
      'nfc.error.readFailed'
    )
  })
})

describe('nfcDisabledError', () => {
  it('carries the translated turn-on-NFC message for other NFC screens', () => {
    expect(new NfcDisabledError().message).toBe(
      t('watchonly.read.nfcTurnOnInSettings')
    )
  })
})
