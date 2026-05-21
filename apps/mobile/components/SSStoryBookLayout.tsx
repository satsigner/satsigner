import type { Decorator } from '@storybook/react'
import { View } from 'react-native'

import { Colors, Layout } from '@/styles'

function SSStoryBookLayout({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: Colors.transparent,
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: Layout.mainContainer.paddingHorizontal,
        width: '100%'
      }}
    >
      {children}
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
