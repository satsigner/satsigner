import { withBackgrounds } from '@storybook/addon-ondevice-backgrounds'
import type { Meta, StoryObj } from '@storybook/react'

import { storybookBackgrounds } from '@/.storybook/utils/backgrounds'

import SSButton from './SSButton'
import storybookLayoutDecorator from './SSStoryBookLayout'

const meta = {
  argTypes: {
    loading: {
      control: 'boolean',
      description: 'Button loading'
    },
    uppercase: {
      control: 'boolean',
      description: 'Text uppercase'
    },
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'outline',
        'ghost',
        'subtle',
        'gradient',
        'elevated',
        'danger'
      ]
    },
    withSelect: {
      control: 'boolean',
      description: 'With select icon'
    }
  },
  args: {
    gradientType: 'default',
    label: 'Satsigner',
    variant: 'default'
  },
  component: SSButton,
  decorators: [storybookLayoutDecorator, withBackgrounds],
  parameters: {
    backgrounds: storybookBackgrounds
  },
  title: 'SSButton'
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
  argTypes: {
    gradientType: {
      control: 'select',
      options: ['default', 'special']
    }
  },
  args: {
    variant: 'gradient'
  }
}

export const Elevated: Story = {
  args: {
    variant: 'elevated'
  }
}

export const Danger: Story = {
  args: {
    variant: 'danger'
  }
}
