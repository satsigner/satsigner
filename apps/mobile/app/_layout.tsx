import { Stack } from 'expo-router'

import { Colors, Typography } from '@/styles'
import { i18n } from '@/locales'
import { View, StyleSheet } from 'react-native'
import SSText from '@/components/SSText'

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
          headerTitleAlign: 'center',
          headerTitle: () => (
            <SSText uppercase>{i18n.t('satsigner.name')}</SSText>
          )
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
