import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import {
  type DrawerContentComponentProps,
  DrawerContentScrollView,
  useDrawerStatus
} from 'expo-router/build/react-navigation/drawer'
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native'

import { SSIconAbout, SSIconSettings } from '@/components/icons'
import { navMenuGroups } from '@/constants/navItems'
import { APP_VERSION, BUILD_NUMBER } from '@/constants/version'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { PLATFORM } from '@/types/navigation/navMenu'

import SSNavMenuGroup from './SSNavMenuGroup'
import SSText from './SSText'

type SSNavMenuProps = DrawerContentComponentProps

function SSNavMenu(props: SSNavMenuProps) {
  const drawerStatus = useDrawerStatus()
  const router = useRouter()
  const currentPlatform: PLATFORM = Platform.OS as PLATFORM
  const filteredNavMenuGroups = navMenuGroups.reduce(
    (acc, group) => {
      if (group.items && Array.isArray(group.items)) {
        const filteredItems = group.items.filter(
          (item) =>
            item.platform === PLATFORM.HYBRID ||
            item.platform === currentPlatform
        )
        if (filteredItems.length > 0) {
          acc.push({ ...group, items: filteredItems })
        }
      }
      return acc
    },
    [] as typeof navMenuGroups
  )

  return (
    <View
      style={[
        styles.container,
        drawerStatus === 'open' && styles.containerDrawerOpen
      ]}
    >
      <LinearGradient
        colors={['rgba(19, 19, 19, 0)', Colors.black]}
        start={{ x: 0.8, y: 0 }}
        end={{ x: 0.99, y: 0 }}
        style={styles.gradientOverlay}
        pointerEvents="none"
      />
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.contentContainer}
      >
        <SSVStack style={styles.vStackWrapper}>
          {filteredNavMenuGroups.map((group, index) => (
            <SSVStack
              key={`${index} - ${group.title}`}
              style={styles.groupWrapper}
            >
              <SSNavMenuGroup group={group} />
            </SSVStack>
          ))}
        </SSVStack>
        <SSVStack style={styles.footerWrapper}>
          <SSVStack gap="md" style={styles.footerLinks}>
            <TouchableOpacity
              activeOpacity={0.5}
              onPress={() => router.navigate('/settings')}
            >
              <SSHStack gap="sm" style={styles.footerLinkRow}>
                <SSIconSettings width={16} height={16} />
                <SSText size="sm" uppercase style={styles.footerLinkText}>
                  {t('navigation.item.settings')}
                </SSText>
              </SSHStack>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.5}
              onPress={() => router.navigate('/settings/about')}
            >
              <SSHStack gap="sm" style={styles.footerLinkRow}>
                <SSIconAbout width={16} height={16} />
                <SSText size="sm" uppercase style={styles.footerLinkText}>
                  {t('navigation.item.about')}
                </SSText>
              </SSHStack>
            </TouchableOpacity>
          </SSVStack>
          <SSText size="sm" color="muted" style={styles.versionText}>
            {`v${APP_VERSION} (${BUILD_NUMBER})`}
          </SSText>
        </SSVStack>
      </DrawerContentScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.black,
    flex: 1
  },
  containerDrawerOpen: {
    borderRightColor: Colors.gray[925],
    borderRightWidth: 1
  },
  contentContainer: {
    flexGrow: 1
  },
  footerLinkRow: {
    alignItems: 'center'
  },
  footerLinkText: {
    letterSpacing: 1
  },
  footerLinks: {
    marginBottom: 4
  },
  footerWrapper: {
    marginLeft: 30,
    marginVertical: 40
  },
  gradientOverlay: {
    boxShadow: '2px 0 3px rgba(0, 0, 0, 0.25)',
    height: '100%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
    zIndex: 99999
  },
  groupWrapper: {
    gap: 0
  },
  vStackWrapper: {
    gap: 60,
    padding: 12,
    paddingRight: 32,
    paddingTop: 40
  },
  versionText: {
    letterSpacing: 2
  }
})

export default SSNavMenu
