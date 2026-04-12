import { type BottomTabBarButtonProps } from '@react-navigation/bottom-tabs'
import { Tabs, usePathname, useRouter, useSegments } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  type GestureResponderEvent,
  Pressable,
  StyleSheet,
  View
} from 'react-native'

import {
  SSIconConverter,
  SSIconConverterActive,
  SSIconExplorer,
  SSIconExplorerActive,
  SSIconSigner,
  SSIconSignerActive
} from '@/components/icons'
import { Colors } from '@/styles'
import { text } from '@/styles/sizes'
import { showNavigation } from '@/utils/navigation'

export default function TabLayout() {
  const currentPath = usePathname()
  const router = useRouter()
  const segments = useSegments() as string[]
  const [isShowTab, setShowTab] = useState(false)

  type TabSegment = '(signer)' | '(explorer)' | '(converter)'

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

  const renderTabButton = (
    props: BottomTabBarButtonProps,
    segment: TabSegment
  ) => {
    const isSelected = segments.includes(segment)
    return (
      <View style={[props.style, styles.tabBarButtonOuter]}>
        <Pressable
          onPress={(e) => handleTabItemPress(props, segment, e)}
          style={[styles.tabBarItem, isSelected && styles.tabBarItemActive]}
        >
          {props.children}
        </Pressable>
      </View>
    )
  }

  useEffect(() => {
    setShowTab(showNavigation(currentPath, segments.length))
  }, [currentPath, segments])

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: 'white',
          tabBarBackground: () => <View style={styles.tabBarBackground} />,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarStyle: [styles.tabBar, { display: isShowTab ? 'flex' : 'none' }]
        }}
        backBehavior="initialRoute"
      >
        <Tabs.Screen
          name="(signer)"
          options={{
            tabBarButton: (props) => renderTabButton(props, '(signer)'),
            tabBarIcon: ({ focused }) =>
              renderTabIcon(focused, SSIconSignerActive, SSIconSigner),
            title: 'Signer'
          }}
        />
        <Tabs.Screen
          name="(explorer)"
          options={{
            tabBarButton: (props) => renderTabButton(props, '(explorer)'),
            tabBarIcon: ({ focused }) =>
              renderTabIcon(focused, SSIconExplorerActive, SSIconExplorer),
            title: 'Explorer'
          }}
        />
        <Tabs.Screen
          name="(converter)"
          options={{
            tabBarButton: (props) => renderTabButton(props, '(converter)'),
            tabBarIcon: ({ focused }) =>
              renderTabIcon(focused, SSIconConverterActive, SSIconConverter),
            title: 'Converter'
          }}
        />
      </Tabs>
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
    height: 82,
    paddingBottom: 20,
    paddingTop: 18
  },
  tabBarBackground: {
    backgroundColor: Colors.gray[925],
    borderTopColor: Colors.gray[850],
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  tabBarButtonOuter: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabBarItem: {
    alignItems: 'center',
    borderRadius: 4,
    height: 54,
    justifyContent: 'center',
    paddingBottom: 2,
    width: 104
  },
  tabBarItemActive: {
    backgroundColor: 'black',
    borderColor: Colors.gray[850],
    borderWidth: 1
  },
  tabBarLabel: {
    fontSize: text.fontSize.xxs,
    letterSpacing: 1,
    marginTop: 2,
    paddingBottom: 2,
    textTransform: 'uppercase'
  }
})
