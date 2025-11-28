import { withBackgrounds } from '@storybook/addon-ondevice-backgrounds'
import type { Meta, StoryObj } from '@storybook/react'

import { storybookBackgrounds } from '@/.storybook/utils/backgrounds'

import SSButton from './SSButton'
import storybookLayoutDecorator from './SSStoryBookLayout'

const meta = {
  title: 'SSButton',
  component: SSButton,
  args: {
    label: 'Satsigner',
    variant: 'default',
    gradientType: 'default'
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
    },
    loading: {
      control: 'boolean',
      description: 'Button loading'
    },
    withSelect: {
      control: 'boolean',
      description: 'With select icon'
    },
    uppercase: {
      control: 'boolean',
      description: 'Text uppercase'
    }
  },
  decorators: [storybookLayoutDecorator, withBackgrounds],
  parameters: {
    backgrounds: storybookBackgrounds
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

export const Outline: Story = {
  args: {
    variant: 'outline'
  }
}

export const Ghost: Story = {
  args: {
    variant: 'ghost'
  }
}

export const Subtle: Story = {
  args: {
    variant: 'subtle'
  }
}

export const Gradient: Story = {
  args: {
    variant: 'gradient'
  },
  argTypes: {
    gradientType: {
      control: 'select',
      options: ['default', 'special']
    }
  }
}

export const Danger: Story = {
  args: {
    variant: 'danger'
  }
}
