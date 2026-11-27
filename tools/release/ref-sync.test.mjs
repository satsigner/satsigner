import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildSyncFetchArgs,
  buildSyncPruneArgs,
  buildSyncPushArgs,
  parseRefList,
  refNames,
  syncCounts,
  syncPlan
} from './ref-sync.mjs'

const A = 'a'.repeat(40)
const B = 'b'.repeat(40)

function branch(overrides) {
  return { github: A, inGithub: false, ngit: A, relation: 'same', ...overrides }
}

const plan = syncPlan({
  branches: [
    branch({ name: 'master', relation: 'github-ahead' }),
    branch({ name: 'fix/ngit-only-work', relation: 'ngit-ahead' }),
    branch({ name: 'feat/new', ngit: undefined }),
    branch({ github: undefined, name: 'proposal', ngit: B }),
    branch({ github: undefined, inGithub: true, name: 'merged', ngit: B }),
    branch({ name: 'chore/prices', relation: 'diverged' }),
    branch({ name: 'onboard' })
  ],
  tags: [
    { github: A, name: 'v0.3.7', ngit: undefined },
    { github: A, name: 'v0.3.6', ngit: A },
    { github: A, name: 'v0.3.5', ngit: B }
  ]
})

test('fetches every branch and tag of a remote into a private namespace', () => {
  assert.deepEqual(buildSyncFetchArgs('ngit'), [
    'fetch',
    '--no-tags',
    '--prune',
    'ngit',
    '+refs/heads/*:refs/sync/ngit/heads/*',
    '+refs/tags/*:refs/sync/ngit/tags/*'
  ])
})

test('reads a ref list and keeps names with slashes', () => {
  const refs = parseRefList(
    `${A} refs/sync/origin/heads/master\n${B} refs/sync/origin/heads/fix/a-b\n\n`,
    'refs/sync/origin/heads'
  )
  assert.deepEqual(
    [...refs],
    [
      ['master', A],
      ['fix/a-b', B]
    ]
  )
})

test('leaves ngit proposal branches out of the comparison', () => {
  const names = refNames(
    new Map([['master', A]]),
    new Map([
      ['master', A],
      ['pr/some-proposal(1a2b3c4d)', B]
    ])
  )
  assert.deepEqual(names, ['master'])
})

test('sorts each ref into a direction', () => {
  const targets = Object.fromEntries(
    plan.map((row) => [`${row.kind}:${row.name}`, row.target])
  )
  assert.deepEqual(targets, {
    'heads:chore/prices': 'conflict',
    'heads:feat/new': 'ngit',
    'heads:fix/ngit-only-work': 'github',
    'heads:master': 'ngit',
    'heads:merged': 'prune',
    'heads:onboard': '',
    'heads:proposal': 'github',
    'tags:v0.3.5': 'conflict',
    'tags:v0.3.6': '',
    'tags:v0.3.7': 'ngit'
  })
  assert.deepEqual(syncCounts(plan), {
    conflict: 2,
    github: 2,
    ngit: 3,
    prune: 1,
    same: 2
  })
})

test('pushes to ngit without force and never touches diverged refs', () => {
  const args = buildSyncPushArgs(plan, 'ngit')
  assert.deepEqual(args, [
    'push',
    'ngit',
    'refs/sync/origin/heads/master:refs/heads/master',
    'refs/sync/origin/heads/feat/new:refs/heads/feat/new',
    'refs/sync/origin/tags/v0.3.7:refs/tags/v0.3.7'
  ])
  assert.equal(
    args.some((arg) => arg.startsWith('+') || arg === '--force'),
    false
  )
})

test('pushes to GitHub from the ngit snapshot', () => {
  assert.deepEqual(buildSyncPushArgs(plan, 'github'), [
    'push',
    'origin',
    'refs/sync/ngit/heads/fix/ngit-only-work:refs/heads/fix/ngit-only-work',
    'refs/sync/ngit/heads/proposal:refs/heads/proposal'
  ])
})

test('deletes only merged leftovers on ngit', () => {
  assert.deepEqual(buildSyncPruneArgs(plan), [
    'push',
    'ngit',
    ':refs/heads/merged'
  ])
})

test('builds no command when there is nothing to do', () => {
  const synced = syncPlan({ branches: [branch({ name: 'master' })], tags: [] })
  assert.deepEqual(buildSyncPushArgs(synced, 'ngit'), [])
  assert.deepEqual(buildSyncPushArgs(synced, 'github'), [])
  assert.deepEqual(buildSyncPruneArgs(synced), [])
})
