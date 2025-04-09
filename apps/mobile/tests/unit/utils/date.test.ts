import { formatRelativeTime } from '../../../utils/date'

describe('formatRelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should return empty string for undefined timestamp', () => {
    expect(formatRelativeTime(undefined)).toBe('')
  })

  it('should format just now for timestamps less than a minute ago', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 30
    expect(formatRelativeTime(timestamp)).toBe('(just now)')
  })

  it('should format minutes ago correctly', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 180
    expect(formatRelativeTime(timestamp)).toBe('(3 minutes ago)')
  })

  it('should format single minute ago correctly', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 60
    expect(formatRelativeTime(timestamp)).toBe('(1 minute ago)')
  })

  it('should format hours ago correctly', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 7200
    expect(formatRelativeTime(timestamp)).toBe('(2 hours ago)')
  })

  it('should format single hour ago correctly', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 3600
    expect(formatRelativeTime(timestamp)).toBe('(1 hour ago)')
  })

  it('should format days ago correctly', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 172800
    expect(formatRelativeTime(timestamp)).toBe('(2 days ago)')
  })

  it('should format single day ago correctly', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 86400
    expect(formatRelativeTime(timestamp)).toBe('(1 day ago)')
  })

  it('should format weeks ago correctly', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 1209600
    expect(formatRelativeTime(timestamp)).toBe('(2 weeks ago)')
  })

  it('should format single week ago correctly', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 604800
    expect(formatRelativeTime(timestamp)).toBe('(1 week ago)')
  })

  it('should format months ago correctly', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 5184000
    expect(formatRelativeTime(timestamp)).toBe('(2 months ago)')
  })

  it('should format single month ago correctly', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 2592000
    expect(formatRelativeTime(timestamp)).toBe('(1 month ago)')
  })

  it('should format years ago correctly', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 63072000
    expect(formatRelativeTime(timestamp)).toBe('(2 years ago)')
  })

  it('should format single year ago correctly', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 31536000
    expect(formatRelativeTime(timestamp)).toBe('(1 year ago)')
  })
})
