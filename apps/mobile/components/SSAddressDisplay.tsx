import { StyleSheet } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import { Colors } from '@/styles'

import SSClipboardCopy from './SSClipboardCopy'
import SSText, { type SSTextProps } from './SSText'

type SSAddressDisplayProps = {
  address: string
  copyToClipboard?: boolean
  variant?: 'default' | 'outline' | 'bare'
} & SSTextProps

function AddressDisplayContent({
  address,
  variant,
  ...props
}: Omit<SSAddressDisplayProps, 'copyToClipboard'>) {
  return (
    <SSHStack style={styles[variant ?? 'default']} gap="sm">
      {(address.match(/(.{1,4})/g) || []).map((bytes, index) => (
        <SSText type="mono" size="md" {...props} key={`${index}-${bytes}`}>
          {bytes}
        </SSText>
      ))}
    </SSHStack>
  )
}

function SSAddressDisplay({
  address,
  variant = 'default',
  copyToClipboard = true,
  ...props
}: SSAddressDisplayProps) {
  if (!copyToClipboard)
    return (
      <AddressDisplayContent address={address} variant={variant} {...props} />
    )

  return (
    <SSClipboardCopy text={address}>
      <AddressDisplayContent address={address} variant={variant} {...props} />
    </SSClipboardCopy>
  )
}

const styles = StyleSheet.create({
  bare: {
    flexWrap: 'wrap',
    padding: 0,
    width: '100%'
  },
  default: {
    backgroundColor: Colors.gray[800],
    borderRadius: 5,
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 12,
    width: '100%'
  },
  outline: {
    borderColor: Colors.gray[600],
    borderRadius: 5,
    borderWidth: 1,
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 12,
    width: '100%'
  }
})

export default SSAddressDisplay
