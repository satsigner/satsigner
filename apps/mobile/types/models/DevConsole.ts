export type DevConsoleLevel = 'error' | 'info' | 'step' | 'warn'

export type DevConsoleEntry = {
  id: number
  level: DevConsoleLevel
  message: string
  scope: string
  time: number
}
