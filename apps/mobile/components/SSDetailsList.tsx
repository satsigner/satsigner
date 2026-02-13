import { router } from 'expo-router'
import { type DimensionValue, TouchableOpacity, View } from 'react-native'

import SSText, { type SSTextProps } from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'

import SSClipboardCopy from './SSClipboardCopy'

type nullableText = string | number | undefined

type SSDetailsListItemProps = {
  header: string
  text?: nullableText
  headerSize?: SSTextProps['size']
  textSize?: SSTextProps['size']
  variant?: 'mono' | 'sans-serif'
  width?: DimensionValue
  uppercase?: boolean
  copyToClipboard?: boolean
  navigateToLink?: string
}

type commonOptions = Pick<
  SSDetailsListItemProps,
  'headerSize' | 'textSize' | 'uppercase' | 'variant' | 'copyToClipboard'
>

type individualOptions = commonOptions &
  Pick<SSDetailsListItemProps, 'width' | 'navigateToLink'>

type SSDetailsListProps = {
  columns: 1 | 2 | 3 | 4
  items: ([string, nullableText] | [string, nullableText, individualOptions])[]
  gap?: number
} & commonOptions

export default function SSDetailsList({
  columns,
  items,
  gap = 8,
  ...commonOptions
}: SSDetailsListProps) {
  const width = `${Math.floor(100 / columns)}%` as DimensionValue
  return (
    <SSHStack
      style={{
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        columnGap: 0,
        rowGap: gap
      }}
    >
      {items.map(([header, text, options], index) => {
        return (
          <SSDetailsListItem
            key={index}
            {...commonOptions}
            {...options}
            {...{ header, text, width: options?.width || width }}
          />
        )
      })}
    </SSHStack>
  )
}

export function SSDetailsListItem({
  header,
  text,
  headerSize = 'sm',
  textSize = 'xs',
  width = '100%',
  variant = 'sans-serif',
  uppercase = true,
  copyToClipboard = false,
  navigateToLink
}: SSDetailsListItemProps) {
  const gap = variant === 'mono' ? 'sm' : 'none'

  // INFO: do not replace `text !== undefined && text === ''` with `!text`
  // because `text` can be the number 0 or -1 and in this case `!text` will
  // eval to false even though the value is intended to be 0 or -1.
  const validText = text !== undefined && text !== ''

  const listItemComponent = (
    <SSVStack gap={gap}>
      <SSText uppercase={uppercase} weight="bold" size={headerSize}>
        {header}
      </SSText>
      <SSText color="muted" type={variant} size={textSize}>
        {validText ? text : '-'}
      </SSText>
    </SSVStack>
  )

  if (copyToClipboard && validText) {
    return (
      <View style={{ width }}>
        <SSClipboardCopy text={text}>{listItemComponent}</SSClipboardCopy>
      </View>
    )
  }

  if (navigateToLink) {
    return (
      <TouchableOpacity
        onPress={() => router.navigate(navigateToLink)}
        style={{ width }}
      >
        {listItemComponent}
      </TouchableOpacity>
    )
  }

  return <View style={{ width }}>{listItemComponent}</View>
}
