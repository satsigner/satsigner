import { withBackgrounds } from '@storybook/addon-ondevice-backgrounds'
import type { Meta, StoryObj } from '@storybook/react'

import { storybookBackgrounds } from '@/.rnstorybook/utils/backgrounds'

import SSCheckbox from './SSCheckbox'
import storybookLayoutDecorator from './SSStoryBookLayout'

const meta = {
  argTypes: {
    description: { control: 'text' },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
    selected: { control: 'boolean' }
  },
  args: {
    description: '',
    disabled: false,
    label: 'Satsigner',
    selected: false
  },
  component: SSCheckbox,
  decorators: [storybookLayoutDecorator, withBackgrounds],
  parameters: {
    backgrounds: storybookBackgrounds
  },
  title: 'SSCheckbox'
} satisfies Meta<typeof SSCheckbox>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Checked: Story = {
  args: {
    selected: true
  }
}

export const WithDescription: Story = {
  args: {
    description: 'Privacy-first Bitcoin signer',
    label: 'Satsigner'
  }
}

export const Disabled: Story = {
  args: {
    disabled: true
  }
}

export const DisabledChecked: Story = {
  args: {
    disabled: true,
    selected: true
  }
}
