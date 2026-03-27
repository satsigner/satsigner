import { useMemo } from 'react'
import { StyleSheet, TouchableHighlight } from 'react-native'

import { Colors, Sizes } from '@/styles'

type SSActionButtonProps = React.ComponentPropsWithoutRef<
  typeof TouchableHighlight
>

function SSActionButton({ style, children, ...props }: SSActionButtonProps) {
  const buttonStyle = useMemo(
    () =>
      StyleSheet.compose(
        {
          ...styles.buttonBase
        },
        style
      ),
    [style]
  )

  return (
    <TouchableHighlight
      activeOpacity={0.65}
      underlayColor={Colors.transparent}
      style={buttonStyle}
      {...props}
    >
      {children}
    </TouchableHighlight>
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
