// Jest mock for @secondts/bark-react-native (native uniffi module can't load
// in Jest). Tests import this file directly (relative path) to reach the
// __-prefixed helpers; jest.config.js maps the package name to this file so
// production code resolves to the same module instance.
type NotificationListener = (event: unknown) => void

export const Network = {
  Bitcoin: 'bitcoin',
  Regtest: 'regtest',
  Signet: 'signet',
  Testnet: 'testnet'
} as const

export const WalletNotification_Tags = {
  MovementCreated: 'MovementCreated',
  MovementUpdated: 'MovementUpdated'
} as const

export const LightningSendStatus_Tags = {
  InProgress: 'InProgress',
  Paid: 'Paid',
  Unknown: 'Unknown'
} as const

export const Config = {
  create: (config: Record<string, unknown>) => config
}

export const Wallet = {
  instanceOf: (_obj: unknown): boolean => false,
  open: jest.fn()
}

const notificationInstances = new Set<WalletNotifications>()

export class WalletNotifications {
  private listeners = new Set<NotificationListener>()

  constructor(_wallet: unknown) {
    notificationInstances.add(this)
  }

  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(event: unknown): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  get listenerCount(): number {
    return this.listeners.size
  }
}

export function __emitWalletNotification(event: unknown): void {
  for (const instance of notificationInstances) {
    instance.emit(event)
  }
}

export function __countWalletNotificationListeners(): number {
  return Array.from(notificationInstances).reduce(
    (sum, instance) => sum + instance.listenerCount,
    0
  )
}

export function __resetBarkMock(): void {
  notificationInstances.clear()
  Wallet.open.mockReset()
}
