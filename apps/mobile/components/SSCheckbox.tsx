import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import BouncyCheckbox, {
  type BouncyCheckboxProps
} from 'react-native-bouncy-checkbox'

import SSVStack from '@/layouts/SSVStack'
import { Colors, Sizes } from '@/styles'

import SSText from './SSText'

type SSCheckboxProps = {
  label?: string
  description?: string
  selected: boolean
} & BouncyCheckboxProps

function SSCheckbox({
  label,
  description,
  selected,
  ...props
}: SSCheckboxProps) {
  const innerIconStyle = useMemo(() => {
    return StyleSheet.compose(styles.innerIconStyleBase, {
      borderColor: selected ? Colors.white : Colors.transparent
    })
  }, [selected])

  return (
    <View style={styles.containerBase}>
      <BouncyCheckbox
        isChecked={selected}
        useBuiltInState={false}
        fillColor={Colors.gray[700]}
        unFillColor={Colors.gray[700]}
        size={Sizes.checkbox.height}
        iconStyle={styles.iconStyleBase}
        style={{ width: Sizes.checkbox.height }}
        innerIconStyle={innerIconStyle}
        {...props}
      />
      {label && (
        <SSVStack gap="none" style={{ flex: 1 }}>
          <SSText color="white" size="lg">
            {label}
          </SSText>
          {description && <SSText color="muted">{description}</SSText>}
        </SSVStack>
      )}
    </View>
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
  }
})

export default SSCheckbox
