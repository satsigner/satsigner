import type { Decorator } from '@storybook/react'
import { ScrollView, View } from 'react-native'

import { Layout } from '@/styles'

function SSStoryBookLayout({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        paddingBottom: Layout.mainContainer.paddingBottom,
        paddingHorizontal: Layout.mainContainer.paddingHorizontal,
        paddingTop: Layout.mainContainer.paddingTop,
        width: '100%'
      }}
    >
      <ScrollView>{children}</ScrollView>
    </View>
  )
}

// It is not possible to export a function declaration because the decorators
// of stories must be object instances (and not class or functions).
// Thus, we actually are obligated to create an instance variable.
const storybookLayoutDecorator: Decorator = (Story) => (
  <SSStoryBookLayout>
    <Story />
  </SSStoryBookLayout>
)

export default storybookLayoutDecorator
