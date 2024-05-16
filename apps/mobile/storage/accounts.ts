import { type Account } from '@/types/models/Account'

import { deleteItem, getItem, setItem } from './encrypted'

const ACCOUNTS = 'satsigner.accounts'

async function getAccounts() {
  try {
    const data = await getItem(ACCOUNTS)
    if (!data) return false

    const accounts: Account[] = JSON.parse(data)
    if (!accounts) return false

    return accounts
  } catch (_) {
    return false
  }
}

async function saveAccounts(accounts: Account[]) {
  return setItem(ACCOUNTS, JSON.stringify(accounts))
}

async function deleteAccounts() {
  return deleteItem(ACCOUNTS)
}

export { deleteAccounts, getAccounts, saveAccounts }
