import assert from 'node:assert/strict'
import test from 'node:test'

import { assertChannelCanPublish } from './zapstore-channel.mjs'

test('refuses to publish without the release keystore', () => {
  assert.throws(
    () => assertChannelCanPublish({ hasKeystore: false }),
    /No Android release keystore/
  )
})

test('allows publishing once the release keystore exists', () => {
  assert.doesNotThrow(() => assertChannelCanPublish({ hasKeystore: true }))
})
