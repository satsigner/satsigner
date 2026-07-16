import { useRef } from 'react'
import { type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import TimeAgo from 'react-timeago'

import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { formatDate, formatTime } from '@/utils/format'

import SSText, { type SSTextProps } from './SSText'

// The style is applied both to text and, when a suffix is present, to a
// wrapping SSHStack (a View), so it must satisfy both style shapes.
type SSTimeAgoTextProps = {
  date: Date
  suffix?: string
  live?: boolean
  style?: StyleProp<ViewStyle & TextStyle>
} & Omit<SSTextProps, 'style'>

type OldDateDisplay = {
  agoText: string
  isOld: boolean
}

function SSTimeAgoText({
  date,
  size = 'sm',
  suffix,
  style,
  numberOfLines,
  live = true,
  ...textProps
}: SSTimeAgoTextProps) {
  const displayRef = useRef<OldDateDisplay>({ agoText: '', isOld: false })

  function timeFormatter(value: number, unit: string, timeSuffix: string) {
    if (unit === 'second') {
      displayRef.current = { agoText: '', isOld: false }
      return `${t('time.lessThanAMinute')} ${timeSuffix}`
    }

    if (unit === 'minute' || unit === 'hour') {
      displayRef.current = { agoText: '', isOld: false }
      return `${value} ${unit}${value !== 1 ? 's' : ''} ${timeSuffix}`
    }

    displayRef.current = {
      agoText: `${value} ${unit}${value !== 1 ? 's' : ''} ${timeSuffix}`,
      isOld: true
    }

    return `${formatDate(date)} - ${formatTime(date)}`
  }

  function renderDateText(children: React.ReactNode) {
    const dateNumberOfLines = suffix ? 1 : numberOfLines

    if (displayRef.current.isOld) {
      return (
        <SSText
          color="muted"
          size={size}
          numberOfLines={dateNumberOfLines}
          ellipsizeMode="tail"
          style={{ flexShrink: 1 }}
          {...textProps}
        >
          {children}
          <SSText size={size} style={{ color: Colors.gray[500] }}>
            {` · ${displayRef.current.agoText}`}
          </SSText>
        </SSText>
      )
    }

    return (
      <SSText
        color="muted"
        size={size}
        numberOfLines={dateNumberOfLines}
        ellipsizeMode="tail"
        style={{ flexShrink: 1 }}
        {...textProps}
      >
        {children}
      </SSText>
    )
  }

  function renderSuffixText() {
    if (!suffix) {
      return null
    }

    return (
      <SSText size={size} style={{ color: Colors.gray[500], flexShrink: 0 }}>
        {` · ${suffix}`}
      </SSText>
    )
  }

  return (
    <TimeAgo
      date={date}
      live={live}
      component={
        ((props: { children: React.ReactNode }) => {
          if (suffix) {
            return (
              <SSHStack gap="none" style={[{ flex: 1 }, style]}>
                {renderDateText(props.children)}
                {renderSuffixText()}
              </SSHStack>
            )
          }

          if (displayRef.current.isOld) {
            return (
              <SSText color="muted" size={size} style={style} {...textProps}>
                {props.children}
                <SSText size={size} style={{ color: Colors.gray[500] }}>
                  {` · ${displayRef.current.agoText}`}
                </SSText>
              </SSText>
            )
          }

          return (
            <SSText
              color="muted"
              size={size}
              style={style}
              numberOfLines={numberOfLines}
              {...textProps}
            >
              {props.children}
            </SSText>
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any
      }
      formatter={timeFormatter}
    />
  )
}

export default SSTimeAgoText
