import Drawer from 'expo-router/drawer'
import React from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import SSNavMenu from '@/components/SSNavMenu'

export default function DrawerLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <SSNavMenu {...props} />}
        screenOptions={{
          drawerPosition: 'left',
          headerShown: false,
          drawerType: 'slide',
          drawerStyle: { width: 300 }
        }}
      >
        <Drawer.Screen name="(stacks)" />
      </Drawer>
    </GestureHandlerRootView>
  )
}
