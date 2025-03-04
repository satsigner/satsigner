import { DrawerContentScrollView } from '@react-navigation/drawer'
import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet, View } from 'react-native'

import { navMenuGroups } from '@/constants/navItems'
import { APP_VERSION, BUILD_NUMBER } from '@/constants/version'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'

import SSNavMenuGroup from './SSNavMenuGroup'
import SSText from './SSText'

function SSNavMenu(props: any) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.transparent, Colors.gray[900]]}
        start={{ x: 0.8, y: 0 }}
        end={{ x: 0.99, y: 0 }}
        style={styles.gradientOverlay}
        pointerEvents="none"
      />
      <SSText size="sm" color="muted" style={styles.versionText}>
        {`v${APP_VERSION} (${BUILD_NUMBER})`}
      </SSText>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.contentContainer}
      >
        <SSVStack style={styles.vStackWrapper} justifyBetween>
          {navMenuGroups.map((group, index) => (
            <SSNavMenuGroup key={`${index} - ${group.title}`} group={group} />
          ))}
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
  versionText: {
    position: 'absolute',
    letterSpacing: 2,
    bottom: 30,
    right: 50
  },
  contentContainer: {
    flex: 1
  },
  vStackWrapper: {
    padding: 12,
    paddingRight: 22,
    paddingTop: 40
  }
})

export default SSNavMenu
