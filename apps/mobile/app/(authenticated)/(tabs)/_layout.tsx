import { Tabs } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import {
  SSIconConverter,
  SSIconConverterActive,
  SSIconExplorer,
  SSIconExplorerActive,
  SSIconSigner,
  SSIconSignerActive
} from '@/components/icons'
import { text } from '@/styles/sizes'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarActiveBackgroundColor: 'black',
        tabBarActiveTintColor: 'white'
      }}
    >
      <Tabs.Screen
        name="(signer)"
        options={{
          title: 'Signer',
          tabBarIcon: ({ focused }) =>
            renderTabIcon(focused, SSIconSignerActive, SSIconSigner)
        }}
      />
      <Tabs.Screen
        name="(explorer)"
        options={{
          title: 'Explorer',
          tabBarIcon: ({ focused }) =>
            renderTabIcon(focused, SSIconExplorerActive, SSIconExplorer)
        }}
      />
      <Tabs.Screen
        name="(converter)"
        options={{
          title: 'Converter',
          tabBarIcon: ({ focused }) =>
            renderTabIcon(focused, SSIconConverterActive, SSIconConverter)
        }}
      />
    </Tabs>
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
  tabBar: {
    backgroundColor: '#1F1F1F',
    borderColor: '#323232',
    paddingTop: 8,
    paddingBottom: 8,
    height: 64,
    alignItems: 'center'
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
    marginTop: 2
  },
  iconContainer: {
    width: 24,
    height: 24,
    marginTop: 4,
    justifyContent: 'flex-start',
    alignItems: 'center'
  }
})
