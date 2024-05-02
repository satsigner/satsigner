import * as WebBrowser from 'expo-web-browser'
import { StyleSheet, TouchableOpacity } from 'react-native'

import { Colors } from '@/styles'

import SSText from './SSText'

type SSLinkProps = {
  url: string
  text: string
}

export default function SSLink({ url, text }: SSLinkProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      onPress={async () => await WebBrowser.openBrowserAsync(url)}
    >
      <SSText style={styles.textBase}>{text}</SSText>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  textBase: {
    color: Colors.gray[300],
    textDecorationLine: 'underline'
  }
})
