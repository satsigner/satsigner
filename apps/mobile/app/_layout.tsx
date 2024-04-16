import { Stack } from 'expo-router'

import { Colors, Typography } from '@/styles'
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
            fontFamily: Typography.sfProTextRegular
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
