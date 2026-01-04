export const time = {
  seconds: (seconds: number) => seconds * 1000,
  minutes: (minutes: number) => time.seconds(minutes * 60),
  hours: (hours: number) => time.minutes(hours * 60),
  days: (days: number) => time.hours(days * 24),
  weeks: (weeks: number) => time.days(weeks * 7),
  infinity: Infinity,
  zero: 0
}
