import { Stack } from 'expo-router'

import { Colors } from '@/styles'
import { i18n } from '@/locales'
import { View, StyleSheet } from 'react-native'

export default function Layout() {
  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          contentStyle: {
            backgroundColor: Colors.gray[900]
          },
          headerStyle: {
            backgroundColor: Colors.gray[800]
          },
          headerTintColor: Colors.white,
          headerTitleAlign: 'center',
          headerTitleStyle: {
            fontFamily: 'SF Pro Text Regular'
          },
          title: i18n.t('satsigner.name')
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray[900]
  }
})
