import type { Decorator, StoryFn } from '@storybook/react'
import { ScrollView, View } from 'react-native'

import { Layout } from '@/styles'

function SSStoryBookLayout({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Layout.mainContainer.paddingHorizontal,
        paddingBottom: Layout.mainContainer.paddingBottom,
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
const storybookLayoutDecorator: Decorator = (Story: StoryFn) => (
  <SSStoryBookLayout>
    <Story />
  </SSStoryBookLayout>
)

export default storybookLayoutDecorator
