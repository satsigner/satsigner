import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs'
import { Tabs, usePathname, useRouter, useSegments } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import type { GestureResponderEvent } from 'react-native'

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

  function handleTabItemPress(
    props: BottomTabBarButtonProps,
    segment: string,
    e: GestureResponderEvent
  ) {
    if (
      segments.indexOf(segment) >= 0 &&
      segments.indexOf(segment) < segments.length - 1
    ) {
      router.navigate(`/(authenticated)/(tabs)/${segment}`)
    } else {
      props.onPress?.(e)
    }
  }

  const renderTabButton = (props: BottomTabBarButtonProps, segment: string) => (
    <View style={props.style}>
      <Pressable onPress={(e) => handleTabItemPress(props, segment, e)}>
        {props.children}
      </Pressable>
    </View>
  )

  useEffect(() => {
    setShowTab(showNavigation(currentPath, segments.length))
  }, [currentPath, segments])

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveBackgroundColor: 'black',
          tabBarActiveTintColor: 'white',
          tabBarItemStyle: styles.tabBarItem,
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
    justifyContent: 'flex-start',
    marginTop: 2,
    width: 24
  },
  tabBar: {
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderTopColor: '#323232',
    elevation: 0,
    height: 74,
    paddingBottom: 16,
    paddingTop: 10,
    shadowOpacity: 0
  },
  tabBarItem: {
    borderRadius: 4,
    marginHorizontal: 16,
    maxWidth: 90,
    padding: 4
  },
  tabBarLabel: {
    fontSize: text.fontSize.xxs,
    letterSpacing: 1,
    marginTop: 2,
    paddingBottom: 2,
    textTransform: 'uppercase'
  }
})
