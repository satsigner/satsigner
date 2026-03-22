import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { t } from '@/locales'
import { Colors } from '@/styles'

import SSText from './SSText'

interface SSChecksumStatusProps {
  valid: boolean | 'electrum'
}

function SSChecksumStatus({ valid }: SSChecksumStatusProps) {
  const statusStyle = useMemo(() => {
    if (valid === 'electrum') {return { backgroundColor: Colors.warning }}
    return { backgroundColor: valid ? Colors.success : Colors.error }
  }, [valid])

  return (
    <View style={styles.containerBase}>
      <View style={[styles.statusBase, statusStyle]} />
      <SSText style={styles.textBase}>
        {valid === 'electrum'
          ? t('bitcoin.electrumChecksum')
          : `${valid ? t('common.valid') : t('common.invalid')} ${t('bitcoin.checksum')}`}
      </SSText>
    </View>
  )
}

const styles = StyleSheet.create({
  containerBase: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4
  },
  statusBase: {
    borderRadius: 11 / 2,
    height: 11,
    width: 11
  },
  textBase: {
    textTransform: 'lowercase'
  }
})

export default SSChecksumStatus
