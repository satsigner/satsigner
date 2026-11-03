import assert from 'node:assert/strict'
import test from 'node:test'

import { SOURCE_REPOSITORY, zspPublishArgs } from './zapstore-publish-args.mjs'

const BASE = ['publish', '--json', '--quiet', '--skip-preview']

test('links a local APK to the source repository and its commit', () => {
  assert.deepEqual(
    zspPublishArgs({
      commit: 'abc123',
      indexerMode: false,
      target: 'app.apk',
      usingConfig: false
    }),
    [...BASE, '-r', SOURCE_REPOSITORY, '--commit', 'abc123', 'app.apk']
  )
})

test('skips the commit when the build had local changes', () => {
  assert.deepEqual(
    zspPublishArgs({
      commit: '',
      indexerMode: false,
      target: 'app.apk',
      usingConfig: false
    }),
    [...BASE, '-r', SOURCE_REPOSITORY, 'app.apk']
  )
})

test('leaves repository details to a config yaml', () => {
  assert.deepEqual(
    zspPublishArgs({
      commit: 'abc123',
      indexerMode: false,
      target: 'zapstore.yaml',
      usingConfig: true
    }),
    [...BASE, 'zapstore.yaml']
  )
})

test('keeps indexer mode before the target', () => {
  assert.deepEqual(
    zspPublishArgs({
      commit: '',
      indexerMode: true,
      target: 'app.apk',
      usingConfig: false
    }),
    [...BASE, '--indexer-mode', '-r', SOURCE_REPOSITORY, 'app.apk']
  )
})
