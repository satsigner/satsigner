import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { Shadow } from 'react-native-shadow-2'

import SSHStack from '@/layouts/SSHStack'
import { type NavMenuItem } from '@/types/navigation/navMenu'

import SSText from './SSText'

type SSNavMenuItemProps = {
  group: string
  item: NavMenuItem
  focused?: boolean
}

function SSNavMenuItem({ group, item, focused = false }: SSNavMenuItemProps) {
  const router = useRouter()

  const handlePress = useCallback(() => {
    if (item.isSoon) {
      router.navigate({
        pathname: `(${group.toLowerCase()})/upcoming/`,
        params: { title: item.title }
      })
    } else {
      router.navigate(`(${group.toLowerCase()})${item.url}`)
    }
  }, [item, router, group])

  const opacity = focused || !item.isSoon ? 1 : 0.5

  const content = useMemo(
    () => (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handlePress}
        style={[styles.touchable, { opacity }]}
      >
        <SSHStack style={styles.container}>
          <SSHStack style={styles.iconWrapper}>
            <item.icon />
          </SSHStack>
          <SSText uppercase size="md" style={styles.text}>
            {item.title}
          </SSText>
        </SSHStack>
      </TouchableOpacity>
    ),
    [handlePress, opacity, item]
  )

  const focusedContent = useMemo(
    () => (
      <Shadow distance={25} startColor="#FFFFFF15" style={styles.shadow}>
        <LinearGradient
          colors={['#3F3F3F', '#101010']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          {content}
        </LinearGradient>
      </Shadow>
    ),
    [content]
  )

  return focused ? focusedContent : content
}

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
    height: 46
  },
  container: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  iconWrapper: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center'
  },
  text: {
    letterSpacing: 3
  },
  shadow: {
    width: '100%',
    height: 46
  },
  gradient: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#262626'
  }
})

export default SSNavMenuItem
