import { StyleSheet, TouchableOpacity, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

import SSText from './SSText'

type SSOrphanedInputsBannerProps = {
  count: number
  onRemove: () => void
}

export default function SSOrphanedInputsBanner({
  count,
  onRemove
}: SSOrphanedInputsBannerProps) {
  return (
    <View style={styles.container}>
      <SSHStack justifyBetween style={{ alignItems: 'center' }}>
        <SSText style={styles.message}>
          {t('transaction.orphanedInputs.warning', { count })}
        </SSText>
        <TouchableOpacity onPress={onRemove} style={styles.button}>
          <SSText style={styles.buttonText}>
            {t('transaction.orphanedInputs.remove')}
          </SSText>
        </TouchableOpacity>
      </SSHStack>
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    borderColor: Colors.error,
    borderRadius: 4,
    borderWidth: 1,
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  buttonText: {
    color: Colors.error,
    fontSize: 11
  },
  container: {
    borderColor: Colors.error,
    borderRadius: 5,
    borderWidth: 1,
    padding: 10
  },
  message: {
    color: Colors.error,
    flex: 1,
    marginRight: 8
  }
})
