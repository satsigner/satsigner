import { StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import { Colors } from '@/styles'

type SSDustWarningBannerProps = {
  message: string
}

export default function SSDustWarningBanner({
  message
}: SSDustWarningBannerProps) {
  return (
    <View style={styles.container}>
      <SSText style={styles.text}>{message}</SSText>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderColor: Colors.warning,
    borderRadius: 5,
    borderWidth: 1,
    padding: 10
  },
  text: {
    color: Colors.warning
  }
})
