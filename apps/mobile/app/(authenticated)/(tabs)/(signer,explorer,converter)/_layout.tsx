import '@/shim'

import {
  type DrawerNavigationProp,
  useDrawerStatus
} from '@react-navigation/drawer'
import { Stack, useNavigation, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  SSIconCloseThin,
  SSIconHamburger,
  SSIconSettings
} from '@/components/icons'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import { t } from '@/locales'
import { Colors } from '@/styles'

export default function StackLayout(params: any) {
  const router = useRouter()
  const nav = useNavigation<DrawerNavigationProp<any>>()

  const isDrawerOpen = useDrawerStatus() === 'open'

  const homeScreen = useMemo(() => {
    switch (params?.segment) {
      case '(signer)':
        return (
          <Stack.Screen
            name="index"
            initialParams={{
              tab: t('navigation.label.signer'),
              segment: params?.segment
            }}
            options={{ title: 'Signer' }}
          />
        )
      case '(explorer)':
        return (
          <Stack.Screen
            name="index"
            initialParams={{
              tab: t('navigation.label.explorer'),
              segment: params?.segment
            }}
            options={{ title: 'Explore' }}
          />
        )
      case '(converter)':
        return (
          <Stack.Screen
            name="index"
            initialParams={{
              tab: t('navigation.label.converter'),
              segment: params?.segment
            }}
            options={{ title: 'Converter' }}
          />
        )
      default:
        return (
          <Stack.Screen
            name="index"
            initialParams={{
              tab: t('navigation.label.signer'),
              segment: params?.segment
            }}
            options={{ title: 'Signer' }}
          />
        )
    }
  }, [params])

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
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              {t('app.name')}
            </SSText>
          ),
          headerBackVisible: false,
          headerLeft: () => (
            <SSIconButton
              style={{ marginLeft: 8 }}
              onPress={() => nav.openDrawer()}
            >
              {isDrawerOpen ? (
                <SSIconCloseThin height={20} width={20} />
              ) : (
                <SSIconHamburger height={18} width={18} />
              )}
            </SSIconButton>
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
      >
        {homeScreen}
      </Stack>
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
