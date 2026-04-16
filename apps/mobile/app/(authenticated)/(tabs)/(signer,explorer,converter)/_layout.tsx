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
import { Platform, type ViewStyle, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
import {
  HEADER_CHROME_EDGE_NUDGE,
  HEADER_CHROME_EYE_TUCK,
  HEADER_CHROME_HIT_BOX,
  HEADER_CHROME_ICON_SIZE,
  HEADER_HEIGHT_TRIM_PX
} from '@/constants/headerChrome'
import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { showNavigation } from '@/utils/navigation'

const HEADER_ICON_STROKE = '#828282'
const HEADER_CLOSE_COLOR = 'rgba(255,255,255,0.6)'

function HeaderLeft({ isShowNav }: { isShowNav: boolean }) {
  const router = useRouter()
  const nav = useNavigation<DrawerNavigationProp<Record<string, undefined>>>()
  const isDrawerOpen = useDrawerStatus() === 'open'
  const [privacyMode, togglePrivacyMode] = useSettingsStore(
    useShallow((state) => [state.privacyMode, state.togglePrivacyMode])
  )

  const iconSize = HEADER_CHROME_ICON_SIZE

  return (
    <SSHStack
      gap="none"
      style={{
        alignItems: 'center',
        marginLeft: -HEADER_CHROME_EDGE_NUDGE
      }}
    >
      {isShowNav ? (
        <SSIconButton
          style={HEADER_CHROME_HIT_BOX}
          onPress={() => nav.openDrawer()}
        >
          {isDrawerOpen ? (
            <SSIconCloseThin
              color={HEADER_CLOSE_COLOR}
              height={iconSize}
              width={iconSize}
            />
          ) : (
            <SSIconHamburger height={iconSize} width={iconSize} />
          )}
        </SSIconButton>
      ) : (
        <SSIconButton
          style={HEADER_CHROME_HIT_BOX}
          onPress={() => router.back()}
        >
          <SSIconBackArrow
            height={iconSize}
            stroke={HEADER_ICON_STROKE}
            width={iconSize}
          />
        </SSIconButton>
      )}
      <SSIconButton
        style={[HEADER_CHROME_HIT_BOX, { marginLeft: -HEADER_CHROME_EYE_TUCK }]}
        onPress={togglePrivacyMode}
      >
        {privacyMode ? (
          <SSIconEyeOff
            height={iconSize}
            stroke={HEADER_ICON_STROKE}
            width={iconSize}
          />
        ) : (
          <SSIconEyeOn
            height={iconSize}
            stroke={HEADER_ICON_STROKE}
            width={iconSize}
          />
        )}
      </SSIconButton>
    </SSHStack>
  )
}

function HeaderRight() {
  const router = useRouter()
  const iconSize = HEADER_CHROME_ICON_SIZE
  return (
    <SSIconButton
      style={
        Platform.OS === 'android' && [
          HEADER_CHROME_HIT_BOX,
          { marginRight: -HEADER_CHROME_EDGE_NUDGE }
        ]
      }
      onPress={() => router.navigate('/settings')}
    >
      <SSIconSettings
        height={iconSize}
        stroke={HEADER_ICON_STROKE}
        width={iconSize}
      />
    </SSIconButton>
  )
}

export default function StackLayout(params: { segment?: string }) {
  const currentPath = usePathname()
  const segments = useSegments()
  const [isShowNav, setShowNav] = useState(false)
  const insets = useSafeAreaInsets()

  const compactHeaderHeight = useMemo(() => {
    const toolbar = Platform.OS === 'ios' ? insets.top + 44 : insets.top + 56
    return toolbar - HEADER_HEIGHT_TRIM_PX
  }, [insets.top])

  const stackHeaderStyle = useMemo<ViewStyle>(
    () => ({
      backgroundColor: Colors.gray[950],
      height: compactHeaderHeight
    }),
    [compactHeaderHeight]
  )

  useEffect(() => {
    setShowNav(showNavigation(currentPath, segments.length))
  }, [currentPath, segments])

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
          // Native stack accepts height; Expo’s Stack typings only allow backgroundColor.
          headerStyle: stackHeaderStyle as { backgroundColor?: string },
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
          headerLeft: () => <HeaderLeft isShowNav={isShowNav} />,
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
