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

  const renderTabButton = (props: BottomTabBarButtonProps, segment: string) => {
    return (
      <View style={props.style}>
        <Pressable onPress={(e) => handleTabItemPress(props, segment, e)}>
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
          tabBarActiveBackgroundColor: 'black',
          tabBarActiveTintColor: 'white',
          tabBarItemStyle: styles.tabBarItem,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarStyle: [
            styles.tabBar,
            { display: isShowTab ? 'flex' : 'none' }
          ]
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
    flex: 1,
    backgroundColor: Colors.gray[950]
  },
  iconContainer: {
    width: 24,
    height: 24,
    marginTop: 2,
    justifyContent: 'flex-start',
    alignItems: 'center'
  },
  tabBar: {
    backgroundColor: '#1F1F1F',
    borderTopColor: '#323232',
    paddingTop: 10,
    paddingBottom: 16,
    height: 74,
    alignItems: 'center',
    elevation: 0,
    shadowOpacity: 0
  },
  tabBarItem: {
    marginHorizontal: 16,
    padding: 4,
    borderRadius: 4,
    maxWidth: 90
  },
  tabBarLabel: {
    textTransform: 'uppercase',
    fontSize: text.fontSize.xxs,
    letterSpacing: 1,
    marginTop: 2,
    paddingBottom: 2
  }
})
