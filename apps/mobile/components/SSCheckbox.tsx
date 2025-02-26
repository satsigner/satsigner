import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import BouncyCheckbox, {
  type BouncyCheckboxProps
} from 'react-native-bouncy-checkbox'

import { Colors, Sizes } from '@/styles'

import SSText from './SSText'

type SSCheckboxProps = {
  label?: string
  selected: boolean
} & BouncyCheckboxProps

function SSCheckbox({ label, selected, ...props }: SSCheckboxProps) {
  const innerIconStyle = useMemo(() => {
    return StyleSheet.compose(styles.innerIconStyleBase, {
      borderColor: selected ? Colors.white : Colors.transparent
    })
  }, [selected])

  return (
    <View style={styles.containerBase}>
      <BouncyCheckbox
        isChecked={selected}
        fillColor={Colors.gray[700]}
        unFillColor={Colors.gray[700]}
        size={Sizes.checkbox.height}
        iconStyle={styles.iconStyleBase}
        innerIconStyle={innerIconStyle}
        {...props}
      />
      {label && (
        <SSText color="white" size="lg">
          {label}
        </SSText>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  containerBase: {
    flexDirection: 'row',
    alignItems: 'center'
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
