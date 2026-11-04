import assert from 'node:assert/strict'
import test from 'node:test'

import { buildEnvEntries } from './zapstore-build-env.mjs'

test('keeps the build env values in a stable order', () => {
  const entries = buildEnvEntries({
    EXPO_PUBLIC_STORYBOOK_ENABLED: 'true',
    APP_VARIANT: 'production',
    EXPO_PROJECT_ID: 'project',
    EXPO_PUBLIC_OTHER: 'inlined'
  })
  assert.deepEqual(entries, [
    ['APP_VARIANT', 'production'],
    ['EXPO_PROJECT_ID', 'project'],
    ['EXPO_PUBLIC_OTHER', 'inlined'],
    ['EXPO_PUBLIC_STORYBOOK_ENABLED', 'true']
  ])
})

test('ignores values the build does not read', () => {
  assert.deepEqual(
    buildEnvEntries({ HOME: '/home/user', PATH: '/bin', ZAPSTORE_NSEC: 'x' }),
    []
  )
})

test('changes when a build env value changes', () => {
  const before = buildEnvEntries({ EXPO_PUBLIC_STORYBOOK_ENABLED: 'false' })
  const after = buildEnvEntries({ EXPO_PUBLIC_STORYBOOK_ENABLED: 'true' })
  assert.notDeepEqual(before, after)
})
