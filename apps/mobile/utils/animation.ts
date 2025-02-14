import { LayoutAnimation, type LayoutAnimationConfig } from 'react-native'

function setStateWithLayoutAnimation<T>(
  setState: React.Dispatch<T>,
  newState: T,
  config: LayoutAnimationConfig = LayoutAnimation.Presets.easeInEaseOut
) {
  LayoutAnimation.configureNext(config)
  setState(newState)
}

export { setStateWithLayoutAnimation }
