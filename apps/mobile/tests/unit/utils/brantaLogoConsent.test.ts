import {
  claimBrantaLogoPrompt,
  getBrantaLogoConsent,
  releaseBrantaLogoPrompt,
  resetBrantaLogoConsent,
  setBrantaLogoSession
} from '@/utils/brantaLogoConsent'

describe('branta logo consent', () => {
  afterEach(() => {
    resetBrantaLogoConsent()
  })

  it('lets the first caller own the prompt', () => {
    claimBrantaLogoPrompt('a')
    claimBrantaLogoPrompt('b')
    expect(getBrantaLogoConsent().ownerId).toBe('a')
  })

  it('keeps a cancel from asking again this session', () => {
    claimBrantaLogoPrompt('a')
    setBrantaLogoSession('deny')
    claimBrantaLogoPrompt('b')
    expect(getBrantaLogoConsent()).toStrictEqual({
      ownerId: null,
      session: 'deny'
    })
  })

  it('releases the prompt when the owner goes away', () => {
    claimBrantaLogoPrompt('a')
    releaseBrantaLogoPrompt('a')
    claimBrantaLogoPrompt('b')
    expect(getBrantaLogoConsent().ownerId).toBe('b')
  })
})
