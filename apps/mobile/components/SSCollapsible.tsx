import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
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

  return (
    <TouchableOpacity activeOpacity={1} onPress={() => handleSetOpen()}>
      <SSVStack>
        <SSVStack style={open ? styles.containerOpen : styles.containerClose}>
          {children}
          <LinearGradient
            style={[
              styles.linearGradientBase,
              open && styles.linearGradientOpen
            ]}
            colors={[Colors.transparent, 'rgba(0,0,0,1)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
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
  containerClose: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: 65,
    overflow: 'hidden',
    position: 'relative'
  },
  containerOpen: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: 'auto',
    position: 'relative'
  },
  linearGradientBase: {
    bottom: 0,
    height: 22,
    left: 0,
    position: 'absolute',
    right: 0
  },
  linearGradientOpen: {
    height: 0
  }
})

export default SSCollapsible
