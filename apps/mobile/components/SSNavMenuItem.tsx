import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

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
        params: { title: item.title },
        pathname: `(${group.toLowerCase()})/upcoming/`
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
      <View style={styles.shadow}>
        <LinearGradient
          colors={['#3F3F3F', '#101010']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          {content}
        </LinearGradient>
      </View>
    ),
    [content]
  )

  return focused ? focusedContent : content
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  gradient: {
    borderColor: '#262626',
    borderRadius: 3,
    borderWidth: 1,
    height: '100%',
    width: '100%'
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 30
  },
  shadow: {
    boxShadow: '0 0 25px #FFFFFF15',
    height: 46,
    width: '100%'
  },
  text: {
    letterSpacing: 3
  },
  touchable: {
    height: 46,
    width: '100%'
  }
})

export default SSNavMenuItem
