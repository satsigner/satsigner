import { StyleSheet } from 'react-native'

import SSHStack from '@/layouts/SSHStack'

import SSText, { type SSTextProps } from './SSText'

type SSBinaryDisplayProps = {
  binary: string
} & SSTextProps

function SSBinaryDisplay({ binary, ...props }: SSBinaryDisplayProps) {
  return (
    <SSHStack gap="sm" style={styles.container}>
      {(binary.match(/(.{1,11})/g) || []).map((bits, index) => (
        <SSText type="mono" size="lg" {...props} key={index}>
          {bits}
        </SSText>
      ))}
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  container: {
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    width: 'auto'
  }
})

export default SSBinaryDisplay
