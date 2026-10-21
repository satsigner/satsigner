import {
  DAYS_PER_WEEK,
  HOURS_PER_DAY,
  MINUTES_PER_HOUR,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE
} from '@/constants/time'

export const time = {
  days: (days: number) => time.hours(days * HOURS_PER_DAY),
  daysAfter: (date: Date, days: number) =>
    date.getTime() + time.hours(days * HOURS_PER_DAY),
  daysBefore: (date: Date, days: number) =>
    date.getTime() - time.hours(days * HOURS_PER_DAY),
  hours: (hours: number) => time.minutes(hours * MINUTES_PER_HOUR),
  hoursAfter: (date: Date, hours: number) =>
    date.getTime() + time.minutes(hours * MINUTES_PER_HOUR),
  hoursBefore: (date: Date, hours: number) =>
    date.getTime() - time.minutes(hours * MINUTES_PER_HOUR),
  infinity: Infinity,
  minutes: (minutes: number) => time.seconds(minutes * SECONDS_PER_MINUTE),
  minutesAfter: (date: Date, minutes: number) =>
    date.getTime() + time.seconds(minutes * SECONDS_PER_MINUTE),
  minutesBefore: (date: Date, minutes: number) =>
    date.getTime() - time.seconds(minutes * SECONDS_PER_MINUTE),
  now: () => new Date().getTime(),
  seconds: (seconds: number) => seconds * MS_PER_SECOND,
  secondsAfter: (date: Date, seconds: number) =>
    date.getTime() + seconds * MS_PER_SECOND,
  secondsBefore: (date: Date, seconds: number) =>
    date.getTime() - seconds * MS_PER_SECOND,
  weeks: (weeks: number) => time.days(weeks * DAYS_PER_WEEK),
  weeksAfter: (date: Date, weeks: number) =>
    date.getTime() + time.days(weeks * DAYS_PER_WEEK),
  weeksBefore: (date: Date, weeks: number) =>
    date.getTime() - time.days(weeks * DAYS_PER_WEEK),
  zero: 0
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Settles like `promise`, or rejects with `message` once `ms` pass first.
 * The timer is cleared either way. `promise` itself keeps running.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = 'Operation timed out'
) {
  const timers: ReturnType<typeof setTimeout>[] = []
  const timedOut = new Promise<never>((_resolve, reject) => {
    timers.push(setTimeout(() => reject(new Error(message)), ms))
  })
  try {
    return await Promise.race([promise, timedOut])
  } finally {
    for (const timer of timers) {
      clearTimeout(timer)
    }
  }
}
