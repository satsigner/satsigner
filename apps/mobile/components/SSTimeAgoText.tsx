import TimeAgo from 'react-timeago'

import { i18n } from '@/locales'
import { formatDate, formatTime } from '@/utils/format'

import SSText from './SSText'

type SSTimeAgoTextProps = {
  date: Date
}

export default function SSTimeAgoText({ date }: SSTimeAgoTextProps) {
  function timeFormatter(value: number, unit: string, suffix: string) {
    if (unit === 'second') return `${i18n.t('time.lessThanAMinute')} ${suffix}`
    else if (unit === 'minute' || unit === 'hour')
      return `${value} ${unit}${value !== 1 ? 's' : ''} ${suffix}`
    else return `${formatTime(date)} - ${formatDate(date)}`
  }

  return (
    <TimeAgo
      date={date}
      live
      component={(props: any) => (
        <SSText color="muted">{props.children}</SSText>
      )}
      formatter={timeFormatter}
    />
  )
}
