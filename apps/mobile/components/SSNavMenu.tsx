import {
  type DrawerContentComponentProps,
  DrawerContentScrollView
} from '@react-navigation/drawer'
import { LinearGradient } from 'expo-linear-gradient'
import { Platform, StyleSheet, View } from 'react-native'

import { navMenuGroups } from '@/constants/navItems'
import { APP_VERSION, BUILD_NUMBER } from '@/constants/version'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'
import { PLATFORM } from '@/types/navigation/navMenu'

import SSNavMenuGroup from './SSNavMenuGroup'
import SSText from './SSText'

type SSNavMenuProps = DrawerContentComponentProps

function SSNavMenu(props: SSNavMenuProps) {
  const currentPlatform: PLATFORM = Platform.OS as PLATFORM
  const filteredNavMenuGroups = navMenuGroups.reduce(
    (acc, group) => {
      if (group.items && Array.isArray(group.items)) {
        const filteredItems = group.items.filter((item) => {
          return (
            item.platform === PLATFORM.HYBRID ||
            item.platform === currentPlatform
          )
        })
        if (filteredItems.length > 0) {
          acc.push({ ...group, items: filteredItems })
        }
      }
      return acc
    },
    [] as typeof navMenuGroups
  )

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.transparent, Colors.gray[950]]}
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
          {filteredNavMenuGroups.map((group, index) => {
            return (
              <SSVStack
                key={`${index} - ${group.title}`}
                style={styles.groupWrapper}
              >
                <SSNavMenuGroup group={group} />
              </SSVStack>
            )
          })}
        </SSVStack>
        <SSVStack style={styles.versionWrapper}>
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
    flex: 1,
    backgroundColor: Colors.black
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    width: '100%',
    zIndex: 99999,
    shadowColor: Colors.black,
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5
  },
  groupWrapper: {
    gap: 0
  },
  contentContainer: {
    flexGrow: 1
  },
  vStackWrapper: {
    gap: 60,
    padding: 12,
    paddingRight: 32,
    paddingTop: 40
  },
  versionWrapper: {
    marginVertical: 40,
    marginLeft: 30
  },
  versionText: {
    letterSpacing: 2
  }
})

export default SSNavMenu
