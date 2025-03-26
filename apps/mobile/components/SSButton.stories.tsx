import type { Meta, StoryObj } from '@storybook/react'

import SSButton from './SSButton'

const meta = {
  title: 'SSButton',
  component: SSButton,
  args: {
    label: 'Satsigner'
  }
} satisfies Meta<typeof SSButton>

export default meta

type Story = StoryObj<typeof meta>

export const Basic: Story = {}

export const AnotherExample: Story = {
  args: {
    label: 'Another example'
  }
}
