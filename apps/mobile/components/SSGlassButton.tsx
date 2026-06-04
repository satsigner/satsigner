import { LinearGradient } from 'expo-linear-gradient'
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewProps
} from 'react-native'

import SSText from '@/components/SSText'
import { Sizes } from '@/styles'

const DECORATION_POINTER: ViewProps['pointerEvents'] = 'none'

type SSGlassButtonProps = {
  label: string
  onPress(): void
  labelColor?: 'black' | 'muted'
  uppercase?: boolean
}

function SSGlassButton({
  label,
  onPress,
  labelColor = 'black',
  uppercase = true
}: SSGlassButtonProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.65}
      onPress={onPress}
      style={styles.glassButton}
    >
      <LinearGradient
        pointerEvents={DECORATION_POINTER}
        colors={['#FFFFFF', '#FAFAFA', '#F4F4F4']}
        end={{ x: 1, y: 0.45 }}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0.5 }}
        style={styles.glassFill}
      />
      <LinearGradient
        pointerEvents={DECORATION_POINTER}
        colors={[
          'rgba(255,255,255,0.92)',
          'rgba(255,255,255,0.25)',
          'rgba(255,255,255,0)'
        ]}
        locations={[0, 0.45, 1]}
        style={[styles.glassLine, styles.glassLineTop]}
      />
      <LinearGradient
        pointerEvents={DECORATION_POINTER}
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.06)', 'rgba(0,0,0,0)']}
        locations={[0, 0.5, 1]}
        style={[styles.glassLine, styles.glassLineBottom]}
      />
      <LinearGradient
        pointerEvents={DECORATION_POINTER}
        colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.18)']}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.glassLine, styles.glassLineLeft]}
      />
      <LinearGradient
        pointerEvents={DECORATION_POINTER}
        colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.07)']}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.glassLine, styles.glassLineRight]}
      />
      <View pointerEvents="none" style={styles.glassLabelLayer}>
        <SSText
          center
          color={labelColor}
          ellipsizeMode="tail"
          numberOfLines={1}
          style={styles.glassLabelText}
          uppercase={uppercase}
        >
          {label.replace(/\n/g, ' ')}
        </SSText>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  glassButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderColor: 'rgba(0,0,0,0.07)',
    borderRadius: Sizes.button.borderRadius,
    borderWidth: 1,
    height: Sizes.button.height,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%'
  },
  glassFill: {
    ...StyleSheet.absoluteFillObject
  },
  glassLabelLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2
  },
  glassLabelText: {
    letterSpacing: 1,
    paddingHorizontal: 12
  },
  glassLine: {
    position: 'absolute'
  },
  glassLineBottom: {
    bottom: 0,
    height: 1,
    left: 0,
    right: 0
  },
  glassLineLeft: {
    bottom: 0,
    left: 0,
    top: 0,
    width: 1
  },
  glassLineRight: {
    bottom: 0,
    right: 0,
    top: 0,
    width: 1
  },
  glassLineTop: {
    height: 1,
    left: 0,
    right: 0,
    top: 0
  }
})

export default SSGlassButton
