import TimeAgo from 'react-timeago'

import { t } from '@/locales'
import { formatDate, formatTime } from '@/utils/format'

import SSText, { type SSTextProps } from './SSText'

type SSTimeAgoTextProps = {
  date: Date
} & SSTextProps

function SSTimeAgoText({ date, ...textProps }: SSTimeAgoTextProps) {
  function timeFormatter(value: number, unit: string, suffix: string) {
    if (unit === 'second') return `${t('time.lessThanAMinute')} ${suffix}`
    else if (unit === 'minute' || unit === 'hour')
      return `${value} ${unit}${value !== 1 ? 's' : ''} ${suffix}`
    else return `${formatDate(date)} - ${formatTime(date)}`
  }

  return (
    <TimeAgo
      date={date}
      live
      component={(props: any) => (
        <SSText color="muted" {...textProps}>
          {props.children}
        </SSText>
      )}
      formatter={timeFormatter}
    />
  )
}

export default SSTimeAgoText
