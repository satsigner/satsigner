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
    '2xxs': 0.3,
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
    '7xl': 2.2,
    '8xl': 2.4
  }

  const gapBySize: Record<TextFontSize, HStackGap> = {
    '2xxs': 'none',
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
    '7xl': 'lg',
    '8xl': 'lg'
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

export default SSSwitch
