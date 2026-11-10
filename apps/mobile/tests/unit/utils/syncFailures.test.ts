import { ElectrumUnreachableError } from '@/api/electrumReachability'
import { MS_PER_MINUTE } from '@/constants/time'
import { t } from '@/locales'
import { SyncTimeoutError } from '@/services/syncQueue'
import { summarizeSyncFailures } from '@/utils/syncFailures'

const HOME_NODE = '192.168.0.13:50001'

function unreachable() {
  return new ElectrumUnreachableError(HOME_NODE)
}

describe('summarizeSyncFailures', () => {
  it('keeps one notice per account for up to two failures', () => {
    expect(
      summarizeSyncFailures([
        { accountName: 'Fafe', error: unreachable() },
        { accountName: 'Support', error: unreachable() }
      ])
    ).toStrictEqual([
      {
        accountName: 'Fafe',
        kind: 'account',
        reason: `Electrum server ${HOME_NODE} is unreachable`,
        server: HOME_NODE
      },
      {
        accountName: 'Support',
        kind: 'account',
        reason: `Electrum server ${HOME_NODE} is unreachable`,
        server: HOME_NODE
      }
    ])
  })

  it('merges three or more accounts with the same unreachable server', () => {
    expect(
      summarizeSyncFailures(
        ['Fafe', 'Support', 'Admin B26', 'Savings'].map((accountName) => ({
          accountName,
          error: unreachable()
        }))
      )
    ).toStrictEqual([
      {
        count: 4,
        kind: 'accounts',
        reason: `Electrum server ${HOME_NODE} is unreachable`,
        server: HOME_NODE
      }
    ])
  })

  it('groups other errors by message and keeps different causes apart', () => {
    const notices = summarizeSyncFailures([
      { accountName: 'A', error: new Error('timeout') },
      { accountName: 'B', error: new Error('timeout') },
      { accountName: 'C', error: new Error('timeout') },
      { accountName: 'D', error: new Error('bad descriptor') }
    ])

    expect(notices).toStrictEqual([
      { count: 3, kind: 'accounts', reason: 'timeout', server: undefined },
      {
        accountName: 'D',
        kind: 'account',
        reason: 'bad descriptor',
        server: undefined
      }
    ])
  })

  it('keeps stalls with different timeouts apart', () => {
    const notices = summarizeSyncFailures(
      [
        { minutes: 2, names: ['A', 'B', 'C'] },
        { minutes: 5, names: ['D', 'E', 'F'] }
      ].flatMap(({ minutes, names }) =>
        names.map((accountName) => ({
          accountName,
          error: new SyncTimeoutError(minutes * MS_PER_MINUTE)
        }))
      )
    )

    expect(notices).toStrictEqual([
      {
        count: 3,
        kind: 'accounts',
        reason: t('account.sync.stalled', { minutes: 2 }),
        server: undefined
      },
      {
        count: 3,
        kind: 'accounts',
        reason: t('account.sync.stalled', { minutes: 5 }),
        server: undefined
      }
    ])
  })

  it('counts an account once when several of its addresses fail', () => {
    const notices = summarizeSyncFailures([
      { accountName: 'Imported', error: unreachable() },
      { accountName: 'Imported', error: unreachable() },
      { accountName: 'Imported', error: unreachable() }
    ])

    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatchObject({
      accountName: 'Imported',
      kind: 'account'
    })
  })
})
