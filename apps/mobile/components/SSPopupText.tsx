import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'

import { Colors } from '@/styles'

import SSText from './SSText'

interface SSSnackbarProps {
  message: string
  isVisible: boolean
  duration?: number
  onTimeout: () => void
}

function SSPopupText({
  message,
  isVisible,
  duration = 600,
  onTimeout
}: SSSnackbarProps) {
  useEffect(() => {
    if (isVisible) {
      const timeout = setTimeout(() => {
        onTimeout()
      }, duration)
      return () => clearTimeout(timeout)
    }
  }, [isVisible, duration, onTimeout])

  return isVisible ? (
    <View style={styles.container}>
      <SSText size="md" style={styles.messageText}>
        {message}
      </SSText>
    </View>
  ) : null
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'column',
    height: '100%',
    justifyContent: 'center',
    position: 'absolute',
    width: '100%'
  },
  messageText: {
    backgroundColor: Colors.gray[800],
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 0,
    width: 'auto'
  }
})

export default SSPopupText
