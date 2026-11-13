import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  APP_VERSION_PATTERN,
  PACKAGE_VERSION_PATTERN,
  bumpVersion,
  hasChangelogSection,
  replaceVersion
} from './version.mjs'

test('bumpVersion raises one part and resets the smaller ones', () => {
  assert.equal(bumpVersion('0.4.2', 'patch'), '0.4.3')
  assert.equal(bumpVersion('0.4.2', 'minor'), '0.5.0')
  assert.equal(bumpVersion('0.4.2', 'major'), '1.0.0')
})

test('bumpVersion rejects bad input', () => {
  assert.throws(() => bumpVersion('0.4', 'patch'))
  assert.throws(() => bumpVersion('0.4.0', 'build'))
})

test('replaceVersion rewrites the package version only', () => {
  const source =
    '{\n  "name": "x",\n  "version": "0.4.0",\n  "deps": { "version": "9" }\n}'
  assert.equal(
    replaceVersion(source, PACKAGE_VERSION_PATTERN, '0.4.1'),
    '{\n  "name": "x",\n  "version": "0.4.1",\n  "deps": { "version": "9" }\n}'
  )
})

test('replaceVersion rewrites APP_VERSION', () => {
  assert.equal(
    replaceVersion(
      "const APP_VERSION = '0.4.0'\n",
      APP_VERSION_PATTERN,
      '1.0.0'
    ),
    "const APP_VERSION = '1.0.0'\n"
  )
})

test('replaceVersion fails when the field is missing', () => {
  assert.throws(() => replaceVersion('{}', PACKAGE_VERSION_PATTERN, '1.0.0'))
})

test('hasChangelogSection finds the release heading', () => {
  assert.equal(hasChangelogSection('## [0.4.0] - 2026-11-13', '0.4.0'), true)
  assert.equal(hasChangelogSection('## [0.4.0] - 2026-11-13', '0.4.1'), false)
})
