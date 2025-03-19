import { StyleSheet } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import { Colors } from '@/styles'

import SSClipboardCopy from './SSClipboardCopy'
import SSText, { type SSTextProps } from './SSText'

type SSAddressDisplayProps = {
  address: string
  variant?: 'box' | 'simple'
} & SSTextProps

function SSAddressDisplay({
  address,
  variant = 'box',
  ...props
}: SSAddressDisplayProps) {
  return (
    <SSClipboardCopy text={address}>
      <SSHStack style={variant === 'box' ? styles.box : styles.simple} gap="sm">
        {(address.match(/(.{1,4})/g) || []).map((bytes, index) => (
          <SSText type="mono" size="md" {...props} key={index}>
            {bytes}
          </SSText>
        ))}
      </SSHStack>
    </SSClipboardCopy>
  )
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: Colors.gray[800],
    flexWrap: 'wrap',
    padding: 12
  },
  simple: {
    flexWrap: 'wrap',
    padding: 0
  }
})

export default SSAddressDisplay
