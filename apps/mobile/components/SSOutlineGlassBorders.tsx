import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet, type ViewProps } from 'react-native'

const decorationPointerEvents: ViewProps['pointerEvents'] = 'none'

function SSOutlineGlassBorders() {
  return (
    <>
      <LinearGradient
        pointerEvents={decorationPointerEvents}
        style={[styles.glassBorder, styles.glassBorderTop]}
        colors={[
          'rgba(255,255,255,0.16)',
          'rgba(255,255,255,0.30)',
          'rgba(255,255,255,0.18)'
        ]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />
      <LinearGradient
        pointerEvents={decorationPointerEvents}
        style={[styles.glassBorder, styles.glassBorderBottom]}
        colors={[
          'rgba(255,255,255,0.06)',
          'rgba(255,255,255,0.20)',
          'rgba(255,255,255,0.06)'
        ]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />
      <LinearGradient
        pointerEvents={decorationPointerEvents}
        style={[styles.glassBorder, styles.glassBorderLeft]}
        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.14)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <LinearGradient
        pointerEvents={decorationPointerEvents}
        style={[styles.glassBorder, styles.glassBorderRight]}
        colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.13)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  glassBorder: {
    position: 'absolute'
  },
  glassBorderBottom: {
    bottom: 0,
    height: 1,
    left: 0,
    right: 0
  },
  glassBorderLeft: {
    bottom: 0,
    left: 0,
    top: 0,
    width: 1
  },
  glassBorderRight: {
    bottom: 0,
    right: 0,
    top: 0,
    width: 1
  },
  glassBorderTop: {
    height: 1,
    left: 0,
    right: 0,
    top: 0
  }
})

export default SSOutlineGlassBorders
