import { type DimensionValue } from 'react-native'

import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'

type SSListItemProps = {
  header: string
  text?: string | number | undefined
  variant?: 'mono' | 'sans-serif'
  width?: DimensionValue
  uppercase?: boolean
}

export default function SSListItem({
  header,
  text = '-',
  width = '100%',
  variant = 'sans-serif',
  uppercase = true
}: SSListItemProps) {
  const gap = variant === 'mono' ? 'sm' : 'none'
  return (
    <SSVStack gap={gap} style={{ width }}>
      <SSText uppercase={uppercase} weight="bold" size="md">
        {header}
      </SSText>
      <SSText color="muted" type={variant}>
        {text}
      </SSText>
    </SSVStack>
  )
}
