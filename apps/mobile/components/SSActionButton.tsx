import { StyleSheet } from 'react-native'

import { Sizes } from '@/styles'

import SSPressable from './SSPressable'

type SSActionButtonProps = React.ComponentPropsWithoutRef<typeof SSPressable>

function SSActionButton({ style, children, ...props }: SSActionButtonProps) {
  return (
    <SSPressable
      activeOpacity={0.65}
      style={[styles.buttonBase, style]}
      {...props}
    >
      {children}
    </SSPressable>
  )
}

const styles = StyleSheet.create({
  buttonBase: {
    alignItems: 'center',
    display: 'flex',
    height: Sizes.actionButton.height,
    justifyContent: 'center'
  }
})

export default SSActionButton
