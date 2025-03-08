import Drawer from 'expo-router/drawer'

import SSNavMenu from '@/components/SSNavMenu'

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={(props) => <SSNavMenu {...props} />}
      screenOptions={{
        drawerPosition: 'left',
        headerShown: false,
        drawerType: 'slide',
        drawerStyle: { width: '75%' }
      }}
    >
      <Drawer.Screen name="(stacks)" />
    </Drawer>
  )
}
