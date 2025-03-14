import { StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import { Layout } from '@/styles'

type SSFormItemProps = {
  children: React.ReactNode
}

function FormItem({ children }: SSFormItemProps) {
  return <View style={styles.containerFormItem}>{children}</View>
}

type SSFormLabelProps = {
  label: string
  center?: boolean
}

function FormLabel({ label, center = true }: SSFormLabelProps) {
  return <SSText style={[center && styles.textFormLabelCenter]}>{label}</SSText>
}

type SSFormLayoutProps = {
  children: React.ReactNode
}

function FormLayout({ children }: SSFormLayoutProps) {
  return <View style={styles.containerForm}>{children}</View>
}

const styles = StyleSheet.create({
  containerForm: {
    flexDirection: 'column',
    width: '100%',
    gap: Layout.form.gap
  },
  containerFormItem: {
    flexDirection: 'column',
    gap: Layout.formItem.gap
  },
  textFormLabelCenter: {
    alignSelf: 'center'
  }
})

const SSFormLayout = Object.assign(FormLayout, {
  Item: FormItem,
  Label: FormLabel
})

export default SSFormLayout
