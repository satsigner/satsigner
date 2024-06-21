import { TouchableOpacity } from 'react-native'

type SSIconButtonProps = React.ComponentPropsWithoutRef<typeof TouchableOpacity>

export default function SSIconButton({
  children,
  ...props
}: SSIconButtonProps) {
  return (
    <TouchableOpacity activeOpacity={0.65} {...props}>
      {children}
    </TouchableOpacity>
  )
}
