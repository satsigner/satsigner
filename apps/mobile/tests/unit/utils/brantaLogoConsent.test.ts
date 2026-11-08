import {
  brantaLogoPromptRef,
  getBrantaLogoConsent,
  resetBrantaLogoConsent,
  setBrantaLogoSession
} from '@/utils/brantaLogoConsent'

const mountedLogos: (() => void)[] = []

function mountWaitingLogo(ownerId: string) {
  const unmount = brantaLogoPromptRef(ownerId)()
  mountedLogos.push(unmount)
  return unmount
}

describe('branta logo consent', () => {
  afterEach(() => {
    for (const unmount of mountedLogos.splice(0)) {
      unmount()
    }
    resetBrantaLogoConsent()
  })

  it('lets the first waiting logo own the prompt', () => {
    mountWaitingLogo('a')
    mountWaitingLogo('b')
    expect(getBrantaLogoConsent().ownerId).toBe('a')
  })

  it('keeps a cancel from asking again this session', () => {
    mountWaitingLogo('a')
    setBrantaLogoSession('deny')
    mountWaitingLogo('b')
    expect(getBrantaLogoConsent()).toStrictEqual({
      ownerId: null,
      session: 'deny'
    })
  })

  it('hands the prompt to the next waiting logo when the owner unmounts', () => {
    const unmountA = mountWaitingLogo('a')
    mountWaitingLogo('b')
    unmountA()
    expect(getBrantaLogoConsent().ownerId).toBe('b')
  })

  it('keeps the owner when another logo unmounts', () => {
    mountWaitingLogo('a')
    const unmountB = mountWaitingLogo('b')
    unmountB()
    expect(getBrantaLogoConsent().ownerId).toBe('a')
  })

  it('clears the owner when the last waiting logo unmounts', () => {
    const unmountA = mountWaitingLogo('a')
    unmountA()
    expect(getBrantaLogoConsent().ownerId).toBeNull()
  })

  it('asks a still-waiting logo again after a reset', () => {
    mountWaitingLogo('a')
    setBrantaLogoSession('deny')
    resetBrantaLogoConsent()
    expect(getBrantaLogoConsent()).toStrictEqual({
      ownerId: 'a',
      session: 'unset'
    })
  })
})
