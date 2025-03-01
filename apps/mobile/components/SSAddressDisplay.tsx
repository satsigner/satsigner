import { StyleSheet } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import { Colors } from '@/styles'

import SSClipboardCopy from './SSClipboardCopy'
import SSText, { type SSTextProps } from './SSText'

type SSAddressDisplayProps = {
  address: string
} & SSTextProps

function SSAddressDisplay({ address, ...props }: SSAddressDisplayProps) {
  return (
    <SSClipboardCopy text={address}>
      <SSHStack style={styles.box} gap='sm'>
        {(address.match(/(.{4})/g) || []).map((bytes, index) => (
          <SSText type="mono" size='md' {...props} key={index}>
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
    padding: 12,
  }
})

export default SSAddressDisplay
