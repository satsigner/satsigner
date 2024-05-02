import { LinearGradient } from 'expo-linear-gradient'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { Platform, StyleSheet, UIManager, View } from 'react-native'

import { Colors } from '@/styles'

SystemUI.setBackgroundColorAsync(Colors.gray[950])

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export default function Layout() {
  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          contentStyle: {
            backgroundColor: Colors.gray[950]
          },
          headerBackground: () => (
            <LinearGradient
              style={{
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              colors={[Colors.gray[900], Colors.gray[800]]}
              start={{ x: 0.94, y: 1.0 }}
              end={{ x: 0.86, y: -0.64 }}
            />
          ),
          headerTitleAlign: 'center',
          headerTintColor: Colors.gray[200],
          headerBackTitleVisible: false
        }}
      />
      <StatusBar style="light" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray[900]
  }
})
