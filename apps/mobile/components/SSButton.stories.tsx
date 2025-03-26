import { withBackgrounds } from '@storybook/addon-ondevice-backgrounds'
import type { Meta, StoryObj } from '@storybook/react'
import { View } from 'react-native'

import SSButton from './SSButton'

const meta = {
  title: 'SSButton',
  component: SSButton,
  args: {
    label: 'Satsigner',
    variant: 'default'
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'outline',
        'ghost',
        'subtle',
        'gradient',
        'danger'
      ]
    }
  },
  decorators: [
    (Story) => (
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          paddingHorizontal: '6%'
        }}
      >
        <Story />
      </View>
    ),
    withBackgrounds
  ],
  parameters: {
    backgrounds: {
      default: 'satsigner',
      values: [
        {
          name: 'satsigner',
          value: '#131313'
        },
        { name: 'black', value: '#000000' }
      ]
    }
  }
} satisfies Meta<typeof SSButton>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Secondary: Story = {
  args: {
    variant: 'secondary'
  }
}
