import { LinearGradient } from 'expo-linear-gradient'
import { useMemo, useState } from 'react'
import { LayoutAnimation, StyleSheet, TouchableOpacity } from 'react-native'

import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

import SSText from './SSText'

type SSCollapsibleProps = {
  children: React.ReactNode
}

function SSCollapsible({ children }: SSCollapsibleProps) {
  const [open, setOpen] = useState(false)

  function handleSetOpen() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setOpen(!open)
  }

  const containerStyle = useMemo(() => {
    return open ? styles.containerOpen : styles.containerClose
  }, [open])

  const linearGradientStyle = useMemo(() => {
    return StyleSheet.compose(styles.linearGradientBase, {
      ...(open ? styles.linearGradientOpen : {})
    })
  }, [open])

  return (
    <TouchableOpacity activeOpacity={1} onPress={() => handleSetOpen()}>
      <SSVStack>
        <SSVStack style={containerStyle}>
          {children}
          <LinearGradient
            style={linearGradientStyle}
            colors={[Colors.transparent, 'rgba(0,0,0,1)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1.0 }}
          />
        </SSVStack>
        <SSText uppercase style={{ color: Colors.gray[100] }}>
          {open ? t('common.less') : t('common.more')}
        </SSText>
      </SSVStack>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  containerOpen: {
    height: 'auto',
    position: 'relative',
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  containerClose: {
    overflow: 'hidden',
    height: 65,
    position: 'relative',
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  linearGradientBase: {
    height: 22,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0
  },
  linearGradientOpen: {
    height: 0
  }
})

export default SSCollapsible
