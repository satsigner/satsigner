import { useMemo } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import BouncyCheckbox from 'react-native-bouncy-checkbox'
import type { BouncyCheckboxProps } from 'react-native-bouncy-checkbox'

import SSVStack from '@/layouts/SSVStack'
import { Colors, Sizes } from '@/styles'

import SSText from './SSText'
import type { SSTextProps } from './SSText'

type SSCheckboxProps = {
  containerStyle?: StyleProp<ViewStyle>
  label?: string
  labelProps?: SSTextProps
  description?: string
  selected: boolean
} & BouncyCheckboxProps

function SSCheckbox({
  label,
  description,
  selected,
  onPress,
  containerStyle = {},
  labelProps = {
    color: 'white',
    size: 'lg'
  },
  disabled,
  ...props
}: SSCheckboxProps) {
  const innerIconStyle = useMemo(
    () =>
      StyleSheet.compose(styles.innerIconStyleBase, {
        borderColor: selected ? Colors.white : Colors.transparent
      }),
    [selected]
  )

  const containerBase = useMemo(
    () =>
      StyleSheet.compose(styles.containerBase, disabled ? styles.disabled : {}),
    [disabled]
  )

  return (
    <TouchableOpacity
      onPress={() => (onPress && !disabled ? onPress(selected) : null)}
    >
      <View style={[containerBase, containerStyle]}>
        <BouncyCheckbox
          isChecked={selected}
          useBuiltInState={false}
          fillColor={Colors.gray[700]}
          unFillColor={Colors.gray[700]}
          size={Sizes.checkbox.height}
          iconStyle={styles.iconStyleBase}
          style={{ width: Sizes.checkbox.height }}
          innerIconStyle={innerIconStyle}
          onPress={onPress}
          disabled={disabled}
          {...props}
        />
        {label && (
          <SSVStack gap="none" style={{ flex: 1 }}>
            <SSText color={disabled ? 'muted' : 'white'} {...labelProps}>
              {label}
            </SSText>
            {description && <SSText color="muted">{description}</SSText>}
          </SSVStack>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  containerBase: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Sizes.checkbox.height / 2
  },
  disabled: {
    opacity: 0.3
  },
  iconStyleBase: {
    borderRadius: Sizes.checkbox.borderRadius
  },
  innerIconStyleBase: {
    borderRadius: Sizes.checkbox.borderRadius,
    borderWidth: Sizes.checkbox.borderWidth
  }
})

export default SSCheckbox
