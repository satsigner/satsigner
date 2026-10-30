import { LinearGradient } from 'expo-linear-gradient'
import { Tabs, usePathname, useRouter, useSegments } from 'expo-router'
import { type BottomTabBarButtonProps } from 'expo-router/js-tabs'
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View
} from 'react-native'
import Animated, { useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  SSIconConverter,
  SSIconConverterActive,
  SSIconExplorer,
  SSIconExplorerActive,
  SSIconSigner,
  SSIconSignerActive
} from '@/components/icons'
import {
  useTabBarBorderStyle,
  useTabBarIndicatorPosition
} from '@/hooks/useTabBarBackgroundAnimation'
import {
  TabBarIndicatorContext,
  useTabBarButtonAnimation,
  useTabBarIconCrossfade
} from '@/hooks/useTabBarButtonAnimation'
import { useTabBarIndicator } from '@/hooks/useTabBarIndicator'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { text } from '@/styles/sizes'
import {
  DEFAULT_TAB_SEGMENT,
  TAB_SEGMENTS,
  type TabSegment
} from '@/types/navigation/tabs'
import { showNavigation } from '@/utils/navigation'
import {
  TAB_BAR_INDICATOR_RADIUS,
  TAB_BAR_ITEM_WIDTH,
  tabSegmentIndex
} from '@/utils/tabBarIndicator'
import { isTabSegment } from '@/utils/tabSegment'

export const unstable_settings = {
  anchor: DEFAULT_TAB_SEGMENT
}

const TAB_BAR_PADDING_Y = 8
const TAB_BAR_ITEM_HEIGHT = 54
const TAB_BAR_HEIGHT = TAB_BAR_PADDING_Y + TAB_BAR_ITEM_HEIGHT

const TAB_TOP_BORDER_GRADIENTS: Record<
  TabSegment,
  {
    colors: readonly [string, string, string, string]
    locations: [number, number, number, number]
  }
> = {
  '(converter)': {
    colors: [
      'rgba(255,255,255,0.0)',
      'rgba(255,255,255,0.05)',
      'rgba(255,255,255,0.20)',
      'rgba(255,255,255,0.08)'
    ] as const,
    locations: [0.3, 0.62, 0.84, 1]
  },
  '(explorer)': {
    colors: [
      'rgba(255,255,255,0.08)',
      'rgba(255,255,255,0.20)',
      'rgba(255,255,255,0.05)',
      'rgba(255,255,255,0.0)'
    ] as const,
    locations: [0, 0.16, 0.38, 0.7]
  },
  '(signer)': {
    colors: [
      'rgba(255,255,255,0.02)',
      'rgba(255,255,255,0.22)',
      'rgba(255,255,255,0.02)',
      'rgba(255,255,255,0.0)'
    ] as const,
    locations: [0, 0.5, 0.85, 1]
  }
}

function TabBarBackground() {
  const barWidth = useSharedValue(0)
  const indicatorStyle = useTabBarIndicatorPosition(barWidth)
  const explorerBorder = useTabBarBorderStyle(0)
  const signerBorder = useTabBarBorderStyle(1)
  const converterBorder = useTabBarBorderStyle(2)
  const borderStyles = {
    '(converter)': converterBorder,
    '(explorer)': explorerBorder,
    '(signer)': signerBorder
  } as const

  function handleLayout(event: LayoutChangeEvent) {
    barWidth.set(event.nativeEvent.layout.width)
  }

  return (
    <View style={styles.tabBarBackground} onLayout={handleLayout}>
      <Animated.View
        pointerEvents="none"
        style={[styles.tabBarIndicator, indicatorStyle]}
      >
        <TabBarIndicatorGlass />
      </Animated.View>
      {TAB_SEGMENTS.map((segment) => (
        <Animated.View
          key={segment}
          pointerEvents="none"
          style={[styles.tabBarTopBorder, borderStyles[segment]]}
        >
          <LinearGradient
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            colors={TAB_TOP_BORDER_GRADIENTS[segment].colors}
            locations={TAB_TOP_BORDER_GRADIENTS[segment].locations}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      ))}
    </View>
  )
}

function TabBarIndicatorGlass() {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.tabBarGlassContainer]}
    >
      <LinearGradient
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        colors={['#0E0E0E', '#060606']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <LinearGradient
        pointerEvents="none"
        style={[styles.glassBorder, styles.glassBorderTop]}
        colors={[
          'rgba(255,255,255,0.05)',
          'rgba(255,255,255,0.12)',
          'rgba(255,255,255,0.03)'
        ]}
        locations={[0, 0.35, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />
      <LinearGradient
        pointerEvents="none"
        style={[styles.glassBorder, styles.glassBorderBottom]}
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />
      <LinearGradient
        pointerEvents="none"
        style={[styles.glassBorder, styles.glassBorderLeft]}
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <LinearGradient
        pointerEvents="none"
        style={[styles.glassBorder, styles.glassBorderRight]}
        colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
    </View>
  )
}

type TabBarButtonProps = {
  bottomTabProps: BottomTabBarButtonProps
  segment: TabSegment
  onPress: (
    props: BottomTabBarButtonProps,
    segment: TabSegment,
    e: GestureResponderEvent
  ) => void
}

function TabBarButton({ bottomTabProps, segment, onPress }: TabBarButtonProps) {
  const { animatedStyle, pressIn, pressOut } = useTabBarButtonAnimation(
    tabSegmentIndex(segment)
  )

  return (
    <View style={[bottomTabProps.style, styles.tabBarButtonOuter]}>
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={(e) => onPress(bottomTabProps, segment, e)}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={styles.tabBarItem}
        >
          <View style={styles.tabBarButtonInner}>
            {bottomTabProps.children}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  )
}

export default function TabLayout() {
  const currentPath = usePathname()
  const router = useRouter()
  const segments: string[] = useSegments()
  const { bottom } = useSafeAreaInsets()
  const isShowTab = showNavigation(currentPath, segments.length)
  const indicatorIndex = useTabBarIndicator(segments.find(isTabSegment))

  function handleTabItemPress(
    props: BottomTabBarButtonProps,
    segment: TabSegment,
    e: GestureResponderEvent
  ) {
    if (
      segments.includes(segment) &&
      segments.indexOf(segment) < segments.length - 1
    ) {
      router.navigate(`/(authenticated)/(tabs)/${segment}`)
    } else {
      props.onPress?.(e)
    }
  }

  return (
    <TabBarIndicatorContext.Provider value={indicatorIndex}>
      <View style={styles.container}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: 'white',
            tabBarBackground: () => <TabBarBackground />,
            tabBarLabelStyle: styles.tabBarLabel,
            tabBarStyle: [
              styles.tabBar,
              {
                display: isShowTab ? 'flex' : 'none',
                height: TAB_BAR_HEIGHT + TAB_BAR_PADDING_Y + bottom,
                paddingBottom: TAB_BAR_PADDING_Y + bottom
              }
            ]
          }}
          backBehavior="initialRoute"
        >
          <Tabs.Screen
            name="(explorer)"
            options={{
              tabBarButton: (props) => (
                <TabBarButton
                  bottomTabProps={props}
                  segment="(explorer)"
                  onPress={handleTabItemPress}
                />
              ),
              tabBarIcon: () => (
                <TabBarIcon
                  segment="(explorer)"
                  ActiveIcon={SSIconExplorerActive}
                  InactiveIcon={SSIconExplorer}
                />
              ),
              title: t('navigation.label.explorer')
            }}
          />
          <Tabs.Screen
            name="(signer)"
            options={{
              tabBarButton: (props) => (
                <TabBarButton
                  bottomTabProps={props}
                  segment="(signer)"
                  onPress={handleTabItemPress}
                />
              ),
              tabBarIcon: () => (
                <TabBarIcon
                  segment="(signer)"
                  ActiveIcon={SSIconSignerActive}
                  InactiveIcon={SSIconSigner}
                />
              ),
              title: t('navigation.label.signer')
            }}
          />
          <Tabs.Screen
            name="(converter)"
            options={{
              tabBarButton: (props) => (
                <TabBarButton
                  bottomTabProps={props}
                  segment="(converter)"
                  onPress={handleTabItemPress}
                />
              ),
              tabBarIcon: () => (
                <TabBarIcon
                  segment="(converter)"
                  ActiveIcon={SSIconConverterActive}
                  InactiveIcon={SSIconConverter}
                />
              ),
              title: t('navigation.label.converter')
            }}
          />
        </Tabs>
      </View>
    </TabBarIndicatorContext.Provider>
  )
}

type TabBarIconProps = {
  segment: TabSegment
  ActiveIcon: React.ElementType
  InactiveIcon: React.ElementType
}

function TabBarIcon({ segment, ActiveIcon, InactiveIcon }: TabBarIconProps) {
  const { activeStyle, inactiveStyle } = useTabBarIconCrossfade(
    tabSegmentIndex(segment)
  )

  return (
    <View style={styles.iconContainer}>
      <Animated.View
        pointerEvents="none"
        style={[styles.iconLayer, inactiveStyle]}
      >
        <InactiveIcon />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.iconLayer, activeStyle]}
      >
        <ActiveIcon />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray[950],
    flex: 1
  },
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
  },
  iconContainer: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 14
  },
  iconLayer: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  tabBar: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    boxShadow: 'none',
    paddingTop: TAB_BAR_PADDING_Y
  },
  tabBarBackground: {
    backgroundColor: Colors.gray[925],
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0
  },
  tabBarButtonInner: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  tabBarButtonOuter: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabBarGlassContainer: {
    borderRadius: TAB_BAR_INDICATOR_RADIUS,
    overflow: 'hidden'
  },
  tabBarIndicator: {
    borderCurve: 'continuous',
    borderRadius: TAB_BAR_INDICATOR_RADIUS,
    height: TAB_BAR_ITEM_HEIGHT,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: TAB_BAR_PADDING_Y,
    width: TAB_BAR_ITEM_WIDTH
  },
  tabBarItem: {
    alignItems: 'center',
    height: TAB_BAR_ITEM_HEIGHT,
    justifyContent: 'center',
    paddingBottom: 2,
    width: TAB_BAR_ITEM_WIDTH
  },
  tabBarLabel: {
    fontSize: text.fontSize.xxs,
    letterSpacing: 1,
    marginTop: 2,
    paddingBottom: 2,
    textTransform: 'uppercase'
  },
  tabBarTopBorder: {
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  }
})
