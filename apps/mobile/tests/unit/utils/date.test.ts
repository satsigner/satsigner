import { formatRelativeTime } from '../../../utils/date'

describe('formatRelativeTime', () => {
  beforeEach(() => {
    // Mock Date.now() to return a fixed timestamp
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-03-23T12:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should return empty string for undefined timestamp', () => {
    expect(formatRelativeTime(undefined)).toBe('')
  })

  it('should format just now for timestamps less than a minute ago', () => {
    const timestamp = (Date.now() / 1000 - 30).toString() // 30 seconds ago
    expect(formatRelativeTime(timestamp)).toMatch(/\(just now\)$/)
  })

  it('should format minutes ago correctly', () => {
    const timestamp = (Date.now() / 1000 - 180).toString() // 3 minutes ago
    expect(formatRelativeTime(timestamp)).toMatch(/\(3 minutes ago\)$/)
  })

  it('should format single minute ago correctly', () => {
    const timestamp = (Date.now() / 1000 - 65).toString() // 1 minute ago
    expect(formatRelativeTime(timestamp)).toMatch(/\(1 minute ago\)$/)
  })

  it('should format hours ago correctly', () => {
    const timestamp = (Date.now() / 1000 - 7200).toString() // 2 hours ago
    expect(formatRelativeTime(timestamp)).toMatch(/\(2 hours ago\)$/)
  })

  it('should format single hour ago correctly', () => {
    const timestamp = (Date.now() / 1000 - 3600).toString() // 1 hour ago
    expect(formatRelativeTime(timestamp)).toMatch(/\(1 hour ago\)$/)
  })

  it('should format days ago correctly', () => {
    const timestamp = (Date.now() / 1000 - 172800).toString() // 2 days ago
    expect(formatRelativeTime(timestamp)).toMatch(/\(2 days ago\)$/)
  })

  it('should format single day ago correctly', () => {
    const timestamp = (Date.now() / 1000 - 86400).toString() // 1 day ago
    expect(formatRelativeTime(timestamp)).toMatch(/\(1 day ago\)$/)
  })

  it('should format weeks ago correctly', () => {
    const timestamp = (Date.now() / 1000 - 1209600).toString() // 2 weeks ago
    expect(formatRelativeTime(timestamp)).toMatch(/\(2 weeks ago\)$/)
  })

  it('should format single week ago correctly', () => {
    const timestamp = (Date.now() / 1000 - 604800).toString() // 1 week ago
    expect(formatRelativeTime(timestamp)).toMatch(/\(1 week ago\)$/)
  })

  it('should format months ago correctly', () => {
    const timestamp = (Date.now() / 1000 - 5184000).toString() // 2 months ago
    expect(formatRelativeTime(timestamp)).toMatch(/\(2 months ago\)$/)
  })

  it('should format single month ago correctly', () => {
    const timestamp = (Date.now() / 1000 - 2592000).toString() // 1 month ago
    expect(formatRelativeTime(timestamp)).toMatch(/\(1 month ago\)$/)
  })

  it('should format years ago correctly', () => {
    const timestamp = (Date.now() / 1000 - 63072000).toString() // 2 years ago
    expect(formatRelativeTime(timestamp)).toMatch(/\(2 years ago\)$/)
  })

  it('should format single year ago correctly', () => {
    const timestamp = (Date.now() / 1000 - 31536000).toString() // 1 year ago
    expect(formatRelativeTime(timestamp)).toMatch(/\(1 year ago\)$/)
  })

  it('should include formatted date in the output', () => {
    const timestamp = (Date.now() / 1000 - 3600).toString() // 1 hour ago
    const result = formatRelativeTime(timestamp)
    expect(result).toMatch(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}/)
  })
})
