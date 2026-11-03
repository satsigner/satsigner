import assert from 'node:assert/strict'
import test from 'node:test'

import { zspPublishArgs } from './zapstore-publish-args.mjs'

const BASE = ['publish', '--json', '--quiet', '--skip-preview']

test('links a local build to its commit', () => {
  assert.deepEqual(
    zspPublishArgs({
      commit: 'abc123',
      indexerMode: false,
      localBuild: true,
      target: 'zapstore.yaml'
    }),
    [...BASE, '--commit', 'abc123', 'zapstore.yaml']
  )
})

test('skips the commit when the build had local changes', () => {
  assert.deepEqual(
    zspPublishArgs({
      commit: '',
      indexerMode: false,
      localBuild: true,
      target: 'zapstore.yaml'
    }),
    [...BASE, 'zapstore.yaml']
  )
})

test('leaves the commit out for a custom config', () => {
  assert.deepEqual(
    zspPublishArgs({
      commit: 'abc123',
      indexerMode: false,
      localBuild: false,
      target: 'custom.yaml'
    }),
    [...BASE, 'custom.yaml']
  )
})

test('keeps indexer mode before the target', () => {
  assert.deepEqual(
    zspPublishArgs({
      commit: '',
      indexerMode: true,
      localBuild: true,
      target: 'zapstore.yaml'
    }),
    [...BASE, '--indexer-mode', 'zapstore.yaml']
  )
})
