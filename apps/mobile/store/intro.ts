import { create } from 'zustand'

type IntroState = {
  visible: boolean
  forceFirstTime: boolean
}

type IntroAction = {
  showIntro: (forceFirstTime?: boolean) => void
  hideIntro: () => void
}

const useIntroStore = create<IntroState & IntroAction>((set) => ({
  forceFirstTime: false,
  hideIntro: () => set({ forceFirstTime: false, visible: false }),
  showIntro: (forceFirstTime = false) => set({ forceFirstTime, visible: true }),
  visible: true
}))

export { useIntroStore }
