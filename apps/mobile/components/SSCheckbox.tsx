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

const DEFAULT_CONTAINER_STYLE: StyleProp<ViewStyle> = {}
const DEFAULT_LABEL_PROPS: SSTextProps = {
  color: 'white',
  size: 'lg'
}

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
  containerStyle = DEFAULT_CONTAINER_STYLE,
  labelProps = DEFAULT_LABEL_PROPS,
  disabled,
  ...props
}: SSCheckboxProps) {
  return (
    <TouchableOpacity
      onPress={() => (onPress && !disabled ? onPress(selected) : null)}
    >
      <View
        style={[
          styles.containerBase,
          disabled && styles.disabled,
          containerStyle
        ]}
      >
        <BouncyCheckbox
          isChecked={selected}
          useBuiltInState={false}
          fillColor={Colors.gray[700]}
          unFillColor={Colors.gray[700]}
          size={Sizes.checkbox.height}
          iconStyle={styles.iconStyleBase}
          style={{ width: Sizes.checkbox.height }}
          innerIconStyle={[
            styles.innerIconStyleBase,
            { borderColor: selected ? Colors.white : Colors.transparent }
          ]}
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
