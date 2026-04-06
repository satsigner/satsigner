import * as WebBrowser from 'expo-web-browser'
import { Platform, StyleSheet, TouchableOpacity } from 'react-native'

import { Colors, Sizes } from '@/styles'
import { type TextFontSize } from '@/styles/sizes'

import SSText from './SSText'

type SSLinkProps = {
  url: string
  text: string
  size?: TextFontSize
}

function SSLink({ url, text, size = 'sm' }: SSLinkProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      onPress={async () => await WebBrowser.openBrowserAsync(url)}
    >
      <SSText
        style={[styles.textBase, { fontSize: Sizes.text.fontSize[size] }]}
      >
        {text}
      </SSText>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  textBase: {
    color: Colors.gray[300],
    marginBottom: Platform.OS === 'android' ? -8 : -2.5,
    marginHorizontal: 4,
    textDecorationLine: 'underline' // TODO: changeme
  }
})

export default SSLink
