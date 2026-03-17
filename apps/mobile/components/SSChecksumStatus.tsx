import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { t } from '@/locales'
import { Colors } from '@/styles'

import SSText from './SSText'

type SSChecksumStatusProps = {
  valid: boolean | 'electrum'
}

function SSChecksumStatus({ valid }: SSChecksumStatusProps) {
  const statusStyle = useMemo(() => {
    if (valid === 'electrum') return { backgroundColor: Colors.warning }
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  statusBase: {
    width: 11,
    height: 11,
    borderRadius: 11 / 2
  },
  textBase: {
    textTransform: 'lowercase'
  }
})

export default SSChecksumStatus
