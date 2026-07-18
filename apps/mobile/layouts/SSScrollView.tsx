import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef
} from 'react-native-keyboard-controller'

type SSScrollViewProps = {
  ref?: React.Ref<KeyboardAwareScrollViewRef>
} & React.ComponentPropsWithoutRef<typeof KeyboardAwareScrollView>

function SSScrollView({
  ref,
  keyboardShouldPersistTaps = 'handled',
  bottomOffset = 24,
  ...props
}: SSScrollViewProps) {
  return (
    <KeyboardAwareScrollView
      ref={ref}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      bottomOffset={bottomOffset}
      {...props}
    />
  )
}

export default SSScrollView
