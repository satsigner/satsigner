import { Tabs } from 'expo-router'

import {
  SSIconConverter,
  SSIconConverterActive,
  SSIconExplorer,
  SSIconExplorerActive,
  SSIconSigner,
  SSIconSignerActive
} from '@/components/icons'

export default function TabLayout() {
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#1F1F1F',
            borderColor: '#323232',
            paddingTop: 8,
            paddingBottom: 8,
            height: 64,
            alignItems: 'center'
          },
          tabBarItemStyle: {
            marginHorizontal: 16,
            padding: 3,
            borderRadius: 4,
            maxWidth: 90
          },
          tabBarLabelStyle: {
            textTransform: 'uppercase',
            fontSize: 9,
            letterSpacing: 1,
            marginTop: 2
          },
          tabBarActiveBackgroundColor: 'black',
          tabBarActiveTintColor: 'white'
        }}
      >
        <Tabs.Screen
          name="(signer)"
          options={{
            title: 'Signer',
            tabBarIcon: ({ focused }) =>
              focused ? <SSIconSignerActive /> : <SSIconSigner />
          }}
        />
        <Tabs.Screen
          name="(explorer)"
          options={{
            title: 'Explorer',
            tabBarIcon: ({ focused }) =>
              focused ? <SSIconExplorerActive /> : <SSIconExplorer />
          }}
        />
        <Tabs.Screen
          name="(converter)"
          options={{
            title: 'Converter',
            tabBarIcon: ({ focused }) =>
              focused ? <SSIconConverterActive /> : <SSIconConverter />
          }}
        />
      </Tabs>
    </>
  )
}
