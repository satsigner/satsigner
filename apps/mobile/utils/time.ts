import { MS_PER_SECOND } from '@/constants/time'

export const time = {
  days: (days: number) => time.hours(days * 24),
  daysAfter: (date: Date, days: number) =>
    date.getTime() + time.hours(days * 24),
  daysBefore: (date: Date, days: number) =>
    date.getTime() - time.hours(days * 24),
  hours: (hours: number) => time.minutes(hours * 60),
  hoursAfter: (date: Date, hours: number) =>
    date.getTime() + time.minutes(hours * 60),
  hoursBefore: (date: Date, hours: number) =>
    date.getTime() - time.minutes(hours * 60),
  infinity: Infinity,
  minutes: (minutes: number) => time.seconds(minutes * 60),
  minutesAfter: (date: Date, minutes: number) =>
    date.getTime() + time.seconds(minutes * 60),
  minutesBefore: (date: Date, minutes: number) =>
    date.getTime() - time.seconds(minutes * 60),
  now: () => new Date().getTime(),
  seconds: (seconds: number) => seconds * MS_PER_SECOND,
  secondsAfter: (date: Date, seconds: number) =>
    date.getTime() + seconds * MS_PER_SECOND,
  secondsBefore: (date: Date, seconds: number) =>
    date.getTime() - seconds * MS_PER_SECOND,
  weeks: (weeks: number) => time.days(weeks * 7),
  weeksAfter: (date: Date, weeks: number) =>
    date.getTime() + time.days(weeks * 7),
  weeksBefore: (date: Date, weeks: number) =>
    date.getTime() - time.days(weeks * 7),
  zero: 0
}
