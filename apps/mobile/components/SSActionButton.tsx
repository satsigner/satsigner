import { useMemo } from 'react'
import { StyleSheet, TouchableHighlight } from 'react-native'

import { Colors, Sizes } from '@/styles'

type SSActionButtonProps = React.ComponentPropsWithoutRef<
  typeof TouchableHighlight
>

export default function SSActionButton({
  style,
  children,
  ...props
}: SSActionButtonProps) {
  const buttonStyle = useMemo(() => {
    return StyleSheet.compose(
      {
        ...styles.buttonBase
      },
      style
    )
  }, [style])

  return (
    <TouchableHighlight
      activeOpacity={0.65}
      underlayColor={Colors.gray[850]}
      style={buttonStyle}
      {...props}
    >
      {children}
    </TouchableHighlight>
  )
}

const styles = StyleSheet.create({
  buttonBase: {
    height: Sizes.actionButton.height,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  }
})
