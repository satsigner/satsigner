import { withBackgrounds } from '@storybook/addon-ondevice-backgrounds'
import type { Meta, StoryObj } from '@storybook/react'

import { storybookBackgrounds } from '@/.storybook/utils/backgrounds'

import SSLabelConflict from './SSLabelConflict'
import SSStoryBookLayout from './SSStoryBookLayout'

const meta = {
  title: 'SSLabelConflict',
  component: SSLabelConflict,
  args: {
    conflicts: [
      [
        {
          label: 'Cold Q',
          ref: 'de9c70fa89736b3193f8f2fbe0546739cef9436a72df6b5ee402b997b69083d0',
          type: 'tx'
        },
        {
          label: 'Cold Q purchase',
          ref: 'de9c70fa89736b3193f8f2fbe0546739cef9436a72df6b5ee402b997b69083d0',
          type: 'tx'
        }
      ],
      [
        {
          label: 'Cold Q',
          ref: 'de9c70fa89736b3193f8f2fbe0546739cef9436a72df6b5ee402b997b69083d0:1',
          type: 'output'
        },
        {
          label: 'Cold Q invoice address',
          ref: 'de9c70fa89736b3193f8f2fbe0546739cef9436a72df6b5ee402b997b69083d0:1',
          type: 'output'
        }
      ],
      [
        {
          label: 'Wage from webdev internship summer program',
          ref: 'bc1qmj3dcj45tugree3f87mrxvc5aqm4hkz4vhskgj',
          type: 'addr'
        },
        {
          label: 'Internship wage',
          ref: 'bc1qmj3dcj45tugree3f87mrxvc5aqm4hkz4vhskgj',
          type: 'addr'
        }
      ]
    ],
    // eslint-disable-next-line
    onResolve: (labels) => console.log(labels) // useful for debugging
  },
  decorators: [SSStoryBookLayout, withBackgrounds],
  parameters: {
    backgrounds: storybookBackgrounds
  }
} satisfies Meta<typeof SSLabelConflict>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
