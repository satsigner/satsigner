import type { ArkNotificationUnsubscribe } from '@/types/models/Ark'

// App-level wallet event subscriptions, one per Ark account. Releasing a
// wallet drops its listeners in the provider, so the entry here must go too
// or the account is never subscribed again until the app is restarted.
const activeSubscriptions = new Map<string, ArkNotificationUnsubscribe>()

function hasArkNotificationSubscription(accountId: string): boolean {
  return activeSubscriptions.has(accountId)
}

function setArkNotificationSubscription(
  accountId: string,
  unsubscribe: ArkNotificationUnsubscribe
): void {
  activeSubscriptions.set(accountId, unsubscribe)
}

/** Unsubscribes and forgets the account's subscription, if any. */
function forgetArkNotificationSubscription(accountId: string): void {
  activeSubscriptions.get(accountId)?.()
  activeSubscriptions.delete(accountId)
}

function listArkNotificationSubscriptionIds(): string[] {
  return [...activeSubscriptions.keys()]
}

export {
  forgetArkNotificationSubscription,
  hasArkNotificationSubscription,
  listArkNotificationSubscriptionIds,
  setArkNotificationSubscription
}
