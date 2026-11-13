import assert from 'node:assert/strict'
import { test } from 'node:test'

import { APP_VERSION_PATTERN, hasChangelogSection } from './version.mjs'

test('APP_VERSION_PATTERN reads the version from app.config.ts', () => {
  assert.equal(
    APP_VERSION_PATTERN.exec("const APP_VERSION = '0.4.0'\n")?.[1],
    '0.4.0'
  )
})

test('hasChangelogSection finds the release heading', () => {
  assert.equal(hasChangelogSection('## [0.4.0] - 2026-11-13', '0.4.0'), true)
  assert.equal(hasChangelogSection('## [0.4.0] - 2026-11-13', '0.4.1'), false)
})
