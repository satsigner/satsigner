import { formatDate, formatRelativeTime } from '../../../utils/date'

// Mock the translation function
jest.mock('@/locales', () => ({
  t: jest.fn((key, params) => {
    if (params) {
      return `${params.value} ${key}`
    }
    return key
  })
}))

describe('date utils', () => {
  // Consistent time for testing
  const constantDate = new Date('2024-01-01T00:00:00Z')
  const constantNowSeconds = Math.floor(constantDate.getTime() / 1000)

  beforeAll(() => {
    // Use fake timers and set a constant system time for all tests in this suite
    jest.useFakeTimers()
    jest.setSystemTime(constantDate)
  })

  afterAll(() => {
    // Restore real timers after all tests in this suite are done
    jest.useRealTimers()
  })

  describe('formatRelativeTime', () => {
    it('should return empty string for undefined timestamp', () => {
      expect(formatRelativeTime(undefined)).toBe('')
    })

    it('should format just now for timestamps less than a minute ago', () => {
      const timestamp = constantNowSeconds - 30
      expect(formatRelativeTime(timestamp)).toBe('(time.justNow)')
    })

    it('should format minutes ago correctly', () => {
      const timestamp = constantNowSeconds - 180 // 3 minutes
      expect(formatRelativeTime(timestamp)).toBe('(3 time.minutesAgo)')
    })

    it('should format single minute ago correctly', () => {
      const timestamp = constantNowSeconds - 60 // 1 minute
      expect(formatRelativeTime(timestamp)).toBe('(time.minuteAgo)')
    })

    it('should format hours ago correctly', () => {
      const timestamp = constantNowSeconds - 7200 // 2 hours
      expect(formatRelativeTime(timestamp)).toBe('(2 time.hoursAgo)')
    })

    it('should format single hour ago correctly', () => {
      const timestamp = constantNowSeconds - 3600 // 1 hour
      expect(formatRelativeTime(timestamp)).toBe('(time.hourAgo)')
    })

    it('should format days ago correctly', () => {
      const timestamp = constantNowSeconds - 172800 // 2 days
      expect(formatRelativeTime(timestamp)).toBe('(2 time.daysAgo)')
    })

    it('should format single day ago correctly', () => {
      const timestamp = constantNowSeconds - 86400 // 1 day
      expect(formatRelativeTime(timestamp)).toBe('(time.dayAgo)')
    })

    it('should format weeks ago correctly', () => {
      const timestamp = constantNowSeconds - 1209600 // 2 weeks
      expect(formatRelativeTime(timestamp)).toBe('(2 time.weeksAgo)')
    })

    it('should format single week ago correctly', () => {
      const timestamp = constantNowSeconds - 604800 // 1 week
      expect(formatRelativeTime(timestamp)).toBe('(time.weekAgo)')
    })

    it('should format months ago correctly', () => {
      // Approx 2 months (using 30 days/month)
      const timestamp = constantNowSeconds - 2 * 30 * 24 * 60 * 60
      expect(formatRelativeTime(timestamp)).toBe('(2 time.monthsAgo)')
    })

    it('should format single month ago correctly', () => {
      // Approx 1 month (using 30 days/month)
      const timestamp = constantNowSeconds - 1 * 30 * 24 * 60 * 60
      expect(formatRelativeTime(timestamp)).toBe('(time.monthAgo)')
    })

    it('should format years ago correctly', () => {
      // Approx 2 years (using 365 days/year)
      const timestamp = constantNowSeconds - 2 * 365 * 24 * 60 * 60
      expect(formatRelativeTime(timestamp)).toBe('(2 time.yearsAgo)')
    })

    it('should format single year ago correctly', () => {
      // Approx 1 year (using 365 days/year)
      const timestamp = constantNowSeconds - 1 * 365 * 24 * 60 * 60
      expect(formatRelativeTime(timestamp)).toBe('(time.yearAgo)')
    })
  })

  describe('formatDate', () => {
    const runInUTC = (fn: () => void) => {
      const originalDate = global.Date
      global.Date = class extends Date {
        getFullYear() {
          return this.getUTCFullYear()
        }
        getMonth() {
          return this.getUTCMonth()
        }
        getDate() {
          return this.getUTCDate()
        }
        getHours() {
          return this.getUTCHours()
        }
        getMinutes() {
          return this.getUTCMinutes()
        }
        getSeconds() {
          return this.getUTCSeconds()
        }
      } as DateConstructor

      try {
        fn()
      } finally {
        global.Date = originalDate
      }
    }

    it('should return an empty string for undefined input', () => {
      expect(formatDate(undefined)).toBe('')
    })

    it('should format a timestamp correctly (UTC)', () => {
      runInUTC(() => {
        const timestamp = 1678881600 // Represents 2023-03-15 12:00:00 UTC
        expect(formatDate(timestamp)).toBe('2023-03-15 12:00:00')
      })
    })

    it('should format another timestamp correctly (UTC)', () => {
      runInUTC(() => {
        const timestamp = 1710504000 // Represents 2024-03-15 12:00:00 UTC
        expect(formatDate(timestamp)).toBe('2024-03-15 12:00:00')
      })
    })

    it('should format timestamp at start of epoch (UTC)', () => {
      runInUTC(() => {
        const timestamp = 0 // Represents 1970-01-01 00:00:00 UTC
        expect(formatDate(timestamp)).toBe('1970-01-01 00:00:00')
      })
    })

    it('should handle padding correctly for single-digit month/day/hour/minute/second (UTC)', () => {
      runInUTC(() => {
        const timestamp = 1672531321 // Represents 2023-01-01 00:02:01 UTC
        expect(formatDate(timestamp)).toBe('2023-01-01 00:02:01')
      })
    })
  })
})
