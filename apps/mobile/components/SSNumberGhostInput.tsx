import { TouchableHighlight } from '@gorhom/bottom-sheet'
import { useState } from 'react'
import { StyleSheet, type TextInput, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import { Colors, Sizes } from '@/styles'
import { formatNumber } from '@/utils/format'

import SSNumberInput from './SSNumberInput'
import SSText from './SSText'

type SSNumberGhostInputProps = {
  min: number
  max: number
  suffix?: string
  allowDecimal?: boolean
} & React.ComponentPropsWithoutRef<typeof TextInput>

function SSNumberGhostInput({
  min,
  max,
  suffix,
  allowDecimal = false,
  ...props
}: SSNumberGhostInputProps) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <View>
      {isEditing ? (
        <SSNumberInput
          align="center"
          min={min}
          max={max}
          autoFocus
          allowDecimal={allowDecimal}
          onBlur={() => setIsEditing(false)}
          {...props}
        />
      ) : (
        <TouchableHighlight
          underlayColor={Colors.gray[850]}
          onPress={() => setIsEditing(true)}
          style={styles.inputButtonBase}
        >
          <SSHStack
            gap="xs"
            style={{ alignItems: 'baseline', justifyContent: 'center' }}
          >
            <SSText size="3xl" weight="medium">
              {formatNumber(Number(props.value), allowDecimal ? 2 : 0)}
            </SSText>
            {suffix ? (
              <SSText color="muted" size="lg">
                {suffix}
              </SSText>
            ) : null}
          </SSHStack>
        </TouchableHighlight>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  inputButtonBase: {
    borderRadius: Sizes.textInput.borderRadius,
    height: Sizes.textInput.height.default,
    justifyContent: 'center'
  }
})

export default SSNumberGhostInput
