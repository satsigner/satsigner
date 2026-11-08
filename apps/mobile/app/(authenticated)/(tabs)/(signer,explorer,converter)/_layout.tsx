import {
  Stack,
  useNavigation,
  usePathname,
  useRouter,
  useSegments
} from 'expo-router'
import { type DrawerNavigationProp, useDrawerStatus } from 'expo-router/drawer'
import { Platform, type ViewStyle, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconCloseThin,
  SSIconEyeOff,
  SSIconEyeOn,
  SSIconHamburger
} from '@/components/icons'
import SSIconBackArrow from '@/components/icons/SSIconBackArrow'
import SSHeaderSettingsButton from '@/components/SSHeaderSettingsButton'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import {
  HEADER_CHROME_EDGE_NUDGE,
  HEADER_CHROME_EYE_TUCK,
  HEADER_CHROME_HIT_BOX,
  HEADER_CHROME_ICON_SIZE,
  HEADER_ICON_STROKE,
  HEADER_HEIGHT_TRIM_PX
} from '@/constants/headerChrome'
import { TabSegmentContext } from '@/hooks/useTabSegment'
import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { showNavigation } from '@/utils/navigation'
import { getTabSegmentLabel, toTabSegment } from '@/utils/tabSegment'

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

export default function StackLayout(params: { segment?: string }) {
  const currentPath = usePathname()
  const segments = useSegments()
  const insets = useSafeAreaInsets()
  const isShowNav = showNavigation(currentPath, segments.length)
  const tabSegment = toTabSegment(params?.segment)

  const toolbarHeight =
    Platform.OS === 'ios' ? insets.top + 44 : insets.top + 56
  const stackHeaderStyle: ViewStyle = {
    backgroundColor: Colors.gray[950],
    height: toolbarHeight - HEADER_HEIGHT_TRIM_PX
  }

  return (
    <TabSegmentContext value={tabSegment}>
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
          headerLeft: () => <HeaderLeft isShowNav={isShowNav} />,
          headerRight: () => <SSHeaderSettingsButton />,
          // Native stack also applies the height; Expo's Stack typings only list backgroundColor.
          headerStyle: stackHeaderStyle,
          headerTintColor: Colors.gray[200],
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              {t('app.name')}
            </SSText>
          ),
          headerTitleAlign: 'center'
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: getTabSegmentLabel(tabSegment) }}
        />
        <Stack.Screen
          name="settings/changePin"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="settings/duressPin"
          options={{ headerShown: false }}
        />
      </Stack>
    </TabSegmentContext>
  )
}
