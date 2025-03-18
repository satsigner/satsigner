import '@/shim'

import { Stack, useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { SSIconSettings } from '@/components/icons'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import { t } from '@/locales'
import { Colors } from '@/styles'

export default function AuthenticatedLayout() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          contentStyle: {
            backgroundColor: Colors.gray[950]
          },
          headerBackground: () => (
            <View
              style={{
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: Colors.gray[950]
              }}
            />
          ),
          headerRight: () => (
            <SSIconButton
              style={{ marginRight: 8 }}
              onPress={() => router.navigate('/settings/')}
            >
              <SSIconSettings height={18} width={18} />
            </SSIconButton>
          ),
          headerTitleAlign: 'center',
          headerTintColor: Colors.gray[200],
          headerBackTitleVisible: false
        }}
      />
      {/* <Stack.Screen
          name="index"
          options={{
            headerTitle: () => (
              <SSText uppercase style={{ letterSpacing: 1 }}>
                {t('app.name')}
              </SSText>
            )
          }}
        />
      </Stack> */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray[900]
  }
})
