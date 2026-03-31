import '@/shim'
import {
  type DrawerNavigationProp,
  useDrawerStatus
} from '@react-navigation/drawer'
import {
  Stack,
  useNavigation,
  usePathname,
  useRouter,
  useSegments
} from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconCloseThin,
  SSIconEyeOff,
  SSIconEyeOn,
  SSIconHamburger,
  SSIconSettings
} from '@/components/icons'
import SSIconBackArrow from '@/components/icons/SSIconBackArrow'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { showNavigation } from '@/utils/navigation'
import { SafeAreaView } from 'react-native-safe-area-context'

function HeaderRight() {
  const router = useRouter()
  const [privacyMode, togglePrivacyMode] = useSettingsStore(
    useShallow((state) => [state.privacyMode, state.togglePrivacyMode])
  )
  return (
    <SSHStack gap="sm">
      <SSIconButton onPress={togglePrivacyMode}>
        {privacyMode ? (
          <SSIconEyeOff height={18} width={18} />
        ) : (
          <SSIconEyeOn height={18} width={18} />
        )}
      </SSIconButton>
      <SSIconButton
        style={{ marginRight: 8 }}
        onPress={() => router.navigate('/settings/')}
      >
        <SSIconSettings height={18} width={18} />
      </SSIconButton>
    </SSHStack>
  )
}

export default function StackLayout(params: { segment?: string }) {
  const currentPath = usePathname()
  const segments = useSegments()
  const [isShowNav, setShowNav] = useState(false)

  useEffect(() => {
    setShowNav(showNavigation(currentPath, segments.length))
  }, [currentPath, segments])

  const router = useRouter()
  const nav = useNavigation<DrawerNavigationProp<Record<string, undefined>>>()

  const isDrawerOpen = useDrawerStatus() === 'open'

  const homeScreen = useMemo(() => {
    switch (params?.segment) {
      case '(signer)':
        return (
          <Stack.Screen
            name="index"
            initialParams={{
              segment: params?.segment,
              tab: t('navigation.label.signer')
            }}
            options={{ title: 'Signer' }}
          />
        )
      case '(explorer)':
        return (
          <Stack.Screen
            name="index"
            initialParams={{
              segment: params?.segment,
              tab: t('navigation.label.explorer')
            }}
            options={{ title: 'Explore' }}
          />
        )
      case '(converter)':
        return (
          <Stack.Screen
            name="index"
            initialParams={{
              segment: params?.segment,
              tab: t('navigation.label.converter')
            }}
            options={{ title: 'Converter' }}
          />
        )
      default:
        return (
          <Stack.Screen
            name="index"
            initialParams={{
              segment: params?.segment,
              tab: t('navigation.label.signer')
            }}
            options={{ title: 'Signer' }}
          />
        )
    }
  }, [params])

  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: {
            backgroundColor: Colors.gray[950]
          },
          headerBackVisible: false,
          headerBackground: () => (
            <View
              style={{
                alignItems: 'center',
                backgroundColor: Colors.gray[950],
                height: '100%',
                justifyContent: 'center'
              }}
            />
          ),
          headerLeft: isShowNav
            ? () => (
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
              )
            : () => (
                <SSIconButton
                  style={{
                    height: 30,
                    paddingHorizontal: 8,
                    paddingTop: 8,
                    width: 30
                  }}
                  onPress={() => router.back()}
                >
                  <SSIconBackArrow height={16} width={7} />
                </SSIconButton>
              ),
          headerRight: () => <HeaderRight />,
          headerTintColor: Colors.gray[200],
          headerTitle: () => (
          <SSText uppercase style={{ letterSpacing: 1 }}>
            {t('app.name')}
          </SSText>
          ),
          headerTitleAlign: 'center'
        }}
      >
        {homeScreen}
      </Stack>
      <StatusBar style="light" />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray[950],
    flex: 1
  }
})
