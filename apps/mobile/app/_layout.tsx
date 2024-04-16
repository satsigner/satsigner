import { Stack } from 'expo-router'
import { Colors } from '@/styles'
import { i18n } from '@/locales'
import { View, StyleSheet } from 'react-native'
import SSText from '@/components/SSText'
import { LinearGradient } from 'expo-linear-gradient'

export default function Layout() {
  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          contentStyle: {
            backgroundColor: Colors.gray[900]
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
