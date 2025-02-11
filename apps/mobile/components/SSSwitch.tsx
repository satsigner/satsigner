import { Switch } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { HStackGap } from '@/styles/layout'
import { TextFontSize } from '@/styles/sizes'

import SSText from './SSText'

type SSSwitchProps = {
  position?: 'right' | 'left'
  textOn?: string
  textOff?: string
  value: boolean
  size?: TextFontSize
  onToggle: (newValue: boolean) => void
}

export default function SSSwitch({
  position = 'left',
  textOn = t('common.on'),
  textOff = t('common.off'),
  size = '2xl',
  value,
  onToggle
}: SSSwitchProps) {
  const scaleBySize: Record<TextFontSize, number> = {
    xxs: 0.4,
    xs: 0.5,
    sm: 0.6,
    md: 0.7,
    lg: 0.8,
    xl: 0.9,
    '2xl': 1.1,
    '3xl': 1.3,
    '4xl': 1.5,
    '5xl': 1.7,
    '6xl': 1.9,
    '7xl': 2.2
  }

  const gapBySize: Record<TextFontSize, HStackGap> = {
    xxs: 'none',
    xs: 'none',
    sm: 'none',
    md: 'none',
    lg: 'none',
    xl: 'xxs',
    '2xl': 'sm',
    '3xl': 'md',
    '4xl': 'md',
    '5xl': 'lg',
    '6xl': 'lg',
    '7xl': 'lg'
  }

  return (
    <SSHStack
      gap={gapBySize[size]}
      style={{
        alignItems: 'center',
        alignContent: 'center'
      }}
    >
      {position === 'left' && (
        <SSText size={size}>{value ? textOn : textOff}</SSText>
      )}
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#767577' }}
        style={{
          transform: [
            { scaleX: scaleBySize[size] },
            { scaleY: scaleBySize[size] }
          ]
        }}
      />
      {position === 'right' && (
        <SSText size={size}>{value ? textOn : textOff}</SSText>
      )}
    </SSHStack>
  )
}
