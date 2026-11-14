import assert from 'node:assert/strict'
import test from 'node:test'

import { zspPublishArgs } from './zapstore-publish-args.mjs'

const BASE = ['publish', '--json', '--quiet', '--skip-preview']

test('links a build to its commit', () => {
  assert.deepEqual(
    zspPublishArgs({ commit: 'abc123', target: 'zapstore.yaml' }),
    [...BASE, '--commit', 'abc123', 'zapstore.yaml']
  )
})

test('skips the commit when the build had local changes', () => {
  assert.deepEqual(zspPublishArgs({ commit: '', target: 'zapstore.yaml' }), [
    ...BASE,
    'zapstore.yaml'
  ])
})
