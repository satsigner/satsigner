import { Colors } from '@/styles'
import {
  serverStatusDotColor,
  serverStatusTextColor
} from '@/utils/serverStatusDisplay'

describe('serverStatusDotColor', () => {
  it('shows the privacy color while connected', () => {
    expect(serverStatusDotColor('connected', 'node')).toBe(Colors.serverNode)
    expect(serverStatusDotColor('connected', 'private')).toBe(
      Colors.serverPrivate
    )
    expect(serverStatusDotColor('connected', 'public')).toBe(
      Colors.serverPublic
    )
  })

  it.each(['checking', 'idle'] as const)(
    'dims the privacy color while %s',
    (status) => {
      expect(serverStatusDotColor(status, 'private')).toBe(
        Colors.serverPrivateMuted
      )
    }
  )

  it('turns red when the last check failed, whatever the privacy', () => {
    expect(serverStatusDotColor('failed', 'node')).toBe(Colors.softBarRed)
  })
})

describe('serverStatusTextColor', () => {
  it('matches the live dot while connected', () => {
    expect(serverStatusTextColor('connected', 'public')).toBe(
      Colors.serverPublic
    )
  })

  it('stays readable when not connected', () => {
    expect(serverStatusTextColor('checking', 'node')).toBe(Colors.gray[400])
    expect(serverStatusTextColor('failed', 'node')).toBe(Colors.mainRed)
  })
})
