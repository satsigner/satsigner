import NetInfo from '@react-native-community/netinfo'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

import { useAccountsStore } from '@/store/accounts'
import { useArkStore } from '@/store/ark'
import { useEcashStore } from '@/store/ecash'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { groupBy } from '@/utils/array'

import type { DiagnosticCheck } from '../types'

const appInfoCheck: DiagnosticCheck = {
  category: 'app',
  id: 'appInfo',
  run: (ctx) =>
    Promise.resolve({
      lines: [
        `version ${Constants.expoConfig?.version ?? 'unknown'}`,
        `platform ${Platform.OS} ${String(Platform.Version)}`,
        `bitcoin network ${ctx.network}`
      ],
      status: 'ok'
    })
}

const connectivityCheck: DiagnosticCheck = {
  category: 'app',
  id: 'connectivity',
  async run() {
    const state = await NetInfo.fetch()
    const lines = [
      `type ${state.type}`,
      `connected ${String(state.isConnected)}`,
      `internet reachable ${String(state.isInternetReachable)}`
    ]
    if (state.isConnected === false) {
      return { lines, status: 'fail' }
    }
    if (state.isInternetReachable === false) {
      return { lines, status: 'warn' }
    }
    return { lines, status: 'ok' }
  }
}

const accountsOverviewCheck: DiagnosticCheck = {
  category: 'app',
  id: 'accountsOverview',
  run() {
    const { accounts } = useAccountsStore.getState()
    const byPolicy = groupBy(accounts, (account) => account.policyType)
    const ecashAccounts = Object.keys(useEcashStore.getState().mints).length
    const arkAccounts = useArkStore.getState().accounts.length
    const identities = useNostrIdentityStore.getState().identities.length
    return Promise.resolve({
      lines: [
        `bitcoin accounts ${accounts.length}`,
        ...[...byPolicy].map(
          ([policy, items]) => `  ${policy}: ${items.length}`
        ),
        `ecash accounts ${ecashAccounts}`,
        `ark accounts ${arkAccounts}`,
        `nostr identities ${identities}`
      ],
      status: 'ok'
    })
  }
}

const APP_CHECKS = [appInfoCheck, connectivityCheck, accountsOverviewCheck]

export { APP_CHECKS }
