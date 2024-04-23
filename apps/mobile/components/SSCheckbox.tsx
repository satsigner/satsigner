import { StyleSheet, View } from 'react-native'
import BouncyCheckbox, {
  BouncyCheckboxProps
} from 'react-native-bouncy-checkbox'

import { Colors, Sizes } from '@/styles'

import SSText from './SSText'

type SSCheckboxProps = {
  label: string
  selected: boolean
} & BouncyCheckboxProps

export default function SSCheckbox({
  label,
  selected,
  ...props
}: SSCheckboxProps) {
  return (
    <View style={styles.containerBase}>
      <BouncyCheckbox
        isChecked={selected}
        fillColor={Colors.gray[700]}
        unFillColor={Colors.gray[700]}
        size={Sizes.checkbox.height}
        iconStyle={{ borderRadius: Sizes.checkbox.borderRadius }}
        innerIconStyle={{
          borderWidth: Sizes.checkbox.borderWidth,
          borderColor: selected ? Colors.white : undefined,
          borderRadius: Sizes.checkbox.borderRadius
        }}
        {...props}
      />
      <SSText color="white" size="lg">
        {label}
      </SSText>
    </View>
  )
}

const styles = StyleSheet.create({
  containerBase: {
    flexDirection: 'row',
    alignItems: 'center'
  }
})
