import { useMemo } from 'react'
import {
  type StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle
} from 'react-native'
import BouncyCheckbox, {
  type BouncyCheckboxProps
} from 'react-native-bouncy-checkbox'

import SSVStack from '@/layouts/SSVStack'
import { Colors, Sizes } from '@/styles'

import SSText, { type SSTextProps } from './SSText'

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
  const innerIconStyle = useMemo(() => {
    return StyleSheet.compose(styles.innerIconStyleBase, {
      borderColor: selected ? Colors.white : Colors.transparent
    })
  }, [selected])

  const containerBase = useMemo(() => {
    return StyleSheet.compose(
      styles.containerBase,
      disabled ? styles.disabled : {}
    )
  }, [disabled])

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.checkbox.height / 2
  },
  iconStyleBase: {
    borderRadius: Sizes.checkbox.borderRadius
  },
  innerIconStyleBase: {
    borderWidth: Sizes.checkbox.borderWidth,
    borderRadius: Sizes.checkbox.borderRadius
  },
  disabled: {
    opacity: 0.3
  }
})

export default SSCheckbox
