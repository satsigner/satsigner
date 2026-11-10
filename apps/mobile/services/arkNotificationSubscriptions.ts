import type { ArkNotificationUnsubscribe } from '@/types/models/Ark'

// App-level wallet event subscriptions, one per Ark account. Releasing a
// wallet drops its listeners in the provider, so the entry here must go too
// or the account is never subscribed again until the app is restarted.
const activeSubscriptions = new Map<string, ArkNotificationUnsubscribe>()
// Accounts whose subscribe is still opening the wallet, so another subscribe
// for the same account is skipped. Forgetting every subscription forgets these
// too: an open that locking cancelled can take seconds to fail, and the next
// session must not skip the account meanwhile.
const pendingSubscriptions = new Set<string>()

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

function isArkNotificationSubscriptionPending(accountId: string): boolean {
  return pendingSubscriptions.has(accountId)
}

function setArkNotificationSubscriptionPending(
  accountId: string,
  pending: boolean
): void {
  if (pending) {
    pendingSubscriptions.add(accountId)
    return
  }
  pendingSubscriptions.delete(accountId)
}

function forgetAllArkNotificationSubscriptions(): void {
  pendingSubscriptions.clear()
  for (const accountId of listArkNotificationSubscriptionIds()) {
    forgetArkNotificationSubscription(accountId)
  }
}

export {
  forgetAllArkNotificationSubscriptions,
  forgetArkNotificationSubscription,
  hasArkNotificationSubscription,
  isArkNotificationSubscriptionPending,
  listArkNotificationSubscriptionIds,
  setArkNotificationSubscription,
  setArkNotificationSubscriptionPending
}
