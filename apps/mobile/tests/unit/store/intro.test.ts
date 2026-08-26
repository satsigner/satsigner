import { shouldShowIntro, useIntroStore } from '@/store/intro'

const INTRO_INITIAL_STATE = {
  forceFirstTime: false,
  visible: true
}

describe('useIntroStore', () => {
  beforeEach(() => {
    useIntroStore.setState(INTRO_INITIAL_STATE)
  })

  it('defaults to visible without forcing the first-time path', () => {
    const { forceFirstTime, visible } = useIntroStore.getState()
    expect(visible).toBe(true)
    expect(forceFirstTime).toBe(false)
  })

  it('does not overlay a returning user until replay is requested', () => {
    expect(shouldShowIntro(false)).toBe(false)
    expect(shouldShowIntro(true)).toBe(true)
  })

  it('hideIntro dismisses the overlay even while firstTime is still true', () => {
    useIntroStore.getState().hideIntro()
    expect(useIntroStore.getState().visible).toBe(false)
    expect(shouldShowIntro(true)).toBe(false)
  })

  it('showIntro(true) forces the first-time path for About replay', () => {
    useIntroStore.setState({ forceFirstTime: false, visible: false })
    useIntroStore.getState().showIntro(true)
    expect(useIntroStore.getState()).toMatchObject({
      forceFirstTime: true,
      visible: true
    })
    expect(shouldShowIntro(false)).toBe(true)
  })

  it('showIntro() without force does not cover a returning user', () => {
    useIntroStore.setState({ forceFirstTime: false, visible: false })
    useIntroStore.getState().showIntro()
    expect(useIntroStore.getState().forceFirstTime).toBe(false)
    expect(shouldShowIntro(false)).toBe(false)
    expect(shouldShowIntro(true)).toBe(true)
  })

  it('hideIntro clears forceFirstTime after a forced replay', () => {
    useIntroStore.getState().showIntro(true)
    useIntroStore.getState().hideIntro()
    expect(useIntroStore.getState()).toMatchObject({
      forceFirstTime: false,
      visible: false
    })
    expect(shouldShowIntro(false)).toBe(false)
  })
})
