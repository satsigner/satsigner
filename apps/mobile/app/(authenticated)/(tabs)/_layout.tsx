import { LinearGradient } from 'expo-linear-gradient'
import { Tabs, usePathname, useRouter, useSegments } from 'expo-router'
import { type BottomTabBarButtonProps } from 'expo-router/js-tabs'
import {
  type GestureResponderEvent,
  Pressable,
  StyleSheet,
  View
} from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  SSIconConverter,
  SSIconConverterActive,
  SSIconExplorer,
  SSIconExplorerActive,
  SSIconSigner,
  SSIconSignerActive
} from '@/components/icons'
import SSTourOverlay from '@/components/SSTourOverlay'
import { useTabBarBackgroundAnimation } from '@/hooks/useTabBarBackgroundAnimation'
import { useTabBarButtonAnimation } from '@/hooks/useTabBarButtonAnimation'
import { Colors } from '@/styles'
import { text } from '@/styles/sizes'
import { TAB_SEGMENTS, type TabSegment } from '@/types/navigation/tabs'
import { showNavigation } from '@/utils/navigation'

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

function TabBarBackground({
  activeSegment
}: {
  activeSegment: TabSegment | undefined
}) {
  const animatedStyles = useTabBarBackgroundAnimation(activeSegment)

  return (
    <View style={styles.tabBarBackground}>
      {TAB_SEGMENTS.map((segment) => (
        <Animated.View
          key={segment}
          pointerEvents="none"
          style={[styles.tabBarTopBorder, animatedStyles[segment]]}
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

type TabBarButtonProps = {
  bottomTabProps: BottomTabBarButtonProps
  segment: TabSegment
  isSelected: boolean
  onPress: (
    props: BottomTabBarButtonProps,
    segment: TabSegment,
    e: GestureResponderEvent
  ) => void
}

function TabBarButton({
  bottomTabProps,
  segment,
  isSelected,
  onPress
}: TabBarButtonProps) {
  const animatedStyle = useTabBarButtonAnimation(isSelected)

  return (
    <View style={[bottomTabProps.style, styles.tabBarButtonOuter]}>
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={(e) => onPress(bottomTabProps, segment, e)}
          style={[styles.tabBarItem, isSelected && styles.tabBarItemActive]}
        >
          {isSelected && (
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
          )}
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
  const segments = useSegments() as string[]
  const { bottom } = useSafeAreaInsets()
  const isShowTab = showNavigation(currentPath, segments.length)

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
    <View style={styles.container}>
      <Tabs
        initialRouteName="(signer)"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: 'white',
          tabBarBackground: () => (
            <TabBarBackground
              activeSegment={
                segments.find((s) => TAB_SEGMENTS.includes(s as TabSegment)) as
                  | TabSegment
                  | undefined
              }
            />
          ),
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
                isSelected={segments.includes('(explorer)')}
                onPress={handleTabItemPress}
              />
            ),
            tabBarIcon: ({ focused }) =>
              renderTabIcon(focused, SSIconExplorerActive, SSIconExplorer),
            title: 'Explorer'
          }}
        />
        <Tabs.Screen
          name="(signer)"
          options={{
            tabBarButton: (props) => (
              <TabBarButton
                bottomTabProps={props}
                segment="(signer)"
                isSelected={segments.includes('(signer)')}
                onPress={handleTabItemPress}
              />
            ),
            tabBarIcon: ({ focused }) =>
              renderTabIcon(focused, SSIconSignerActive, SSIconSigner),
            title: 'Signer'
          }}
        />
        <Tabs.Screen
          name="(converter)"
          options={{
            tabBarButton: (props) => (
              <TabBarButton
                bottomTabProps={props}
                segment="(converter)"
                isSelected={segments.includes('(converter)')}
                onPress={handleTabItemPress}
              />
            ),
            tabBarIcon: ({ focused }) =>
              renderTabIcon(focused, SSIconConverterActive, SSIconConverter),
            title: 'Converter'
          }}
        />
      </Tabs>
      <SSTourOverlay />
    </View>
  )
}

const renderTabIcon = (
  focused: boolean,
  ActiveIcon: React.ElementType,
  InactiveIcon: React.ElementType
) => (
  <View style={styles.iconContainer}>
    {focused ? <ActiveIcon /> : <InactiveIcon />}
  </View>
)

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
    borderRadius: 5,
    overflow: 'hidden'
  },
  tabBarItem: {
    alignItems: 'center',
    borderRadius: 2,
    height: TAB_BAR_ITEM_HEIGHT,
    justifyContent: 'center',
    paddingBottom: 2,
    width: 100
  },
  tabBarItemActive: {
    backgroundColor: 'transparent',
    borderRadius: 2
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
