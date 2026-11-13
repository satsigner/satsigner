import { t } from '@/locales'
import {
  lndAliasIsNodeId,
  lndNodeCardTitle,
  lndNodeTitle
} from '@/utils/lndNodeCardTitle'

const PUBKEY = `02${'ab'.repeat(32)}`

describe('lndNodeCardTitle', () => {
  it('returns a short id when alias is missing', () => {
    expect(lndNodeCardTitle('', PUBKEY)).toBe('02ab...abab')
  })

  it('returns a short id when alias is the identity pubkey', () => {
    expect(lndNodeCardTitle(PUBKEY, PUBKEY)).toBe('02ab...abab')
  })

  it('keeps a human alias', () => {
    expect(lndNodeCardTitle('Satsigner', PUBKEY)).toBe('Satsigner')
  })

  it('treats empty alias as an id title', () => {
    expect(lndAliasIsNodeId('', PUBKEY)).toBe(true)
    expect(lndAliasIsNodeId('Satsigner', PUBKEY)).toBe(false)
  })
})

describe('lndNodeTitle', () => {
  it('uses the node alias', () => {
    expect(lndNodeTitle({ alias: 'Satsigner', identity_pubkey: PUBKEY })).toBe(
      'Satsigner'
    )
  })

  it('uses a short id when the node has no alias', () => {
    expect(lndNodeTitle({ alias: '', identity_pubkey: PUBKEY })).toBe(
      '02ab...abab'
    )
  })

  it('falls back to a generic title without node info', () => {
    expect(lndNodeTitle(undefined)).toBe(t('lightning.landing.unknownNode'))
  })
})
