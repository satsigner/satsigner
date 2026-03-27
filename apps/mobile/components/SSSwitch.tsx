import { Switch } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { type HStackGap } from '@/styles/layout'
import { type TextFontSize } from '@/styles/sizes'

import SSText from './SSText'

type SSSwitchProps = {
  position?: 'right' | 'left'
  textOn?: string
  textOff?: string
  size?: TextFontSize
  value: boolean
  onToggle: (newValue: boolean) => void
}

function SSSwitch({
  position = 'left',
  textOn = t('common.on'),
  textOff = t('common.off'),
  size = '2xl',
  value,
  onToggle
}: SSSwitchProps) {
  const scaleBySize: Record<TextFontSize, number> = {
    '2xl': 1.1,
    '2xxs': 0.3,
    '3xl': 1.3,
    '4xl': 1.5,
    '5xl': 1.7,
    '6xl': 1.9,
    '7xl': 2.2,
    '8xl': 2.4,
    lg: 0.8,
    md: 0.7,
    sm: 0.6,
    xl: 0.9,
    xs: 0.5,
    xxs: 0.4
  }

  const gapBySize: Record<TextFontSize, HStackGap> = {
    '2xl': 'sm',
    '2xxs': 'none',
    '3xl': 'md',
    '4xl': 'md',
    '5xl': 'lg',
    '6xl': 'lg',
    '7xl': 'lg',
    '8xl': 'lg',
    lg: 'none',
    md: 'none',
    sm: 'none',
    xl: 'xxs',
    xs: 'none',
    xxs: 'none'
  }

  return (
    <SSHStack
      gap={gapBySize[size]}
      style={{
        alignContent: 'center',
        alignItems: 'center'
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

export default SSSwitch
