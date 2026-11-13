import {
  type DimensionValue,
  type StyleProp,
  StyleSheet,
  type ViewStyle
} from 'react-native'

function isAutoDimension(value: DimensionValue | undefined) {
  return value === undefined || value === 'auto'
}

/** True when the resolved style leaves the width or height to the content. */
function isSizedByContent(style: StyleProp<ViewStyle>) {
  const flattened = StyleSheet.flatten(style)
  return isAutoDimension(flattened?.width) || isAutoDimension(flattened?.height)
}

export { isSizedByContent }
