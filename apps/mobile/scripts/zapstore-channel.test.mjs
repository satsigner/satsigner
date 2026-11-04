import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertChannelCanPublish,
  assertProductionConfirmed,
  assertProductionSource
} from './zapstore-channel.mjs'

test('refuses to publish without the release keystore', () => {
  assert.throws(
    () => assertChannelCanPublish({ hasKeystore: false }),
    /No Android release keystore/
  )
})

test('allows publishing once the release keystore exists', () => {
  assert.doesNotThrow(() => assertChannelCanPublish({ hasKeystore: true }))
})

test('dev and generic channels need no production confirmation', () => {
  for (const channel of ['dev', 'generic', '']) {
    assert.doesNotThrow(() =>
      assertProductionConfirmed({
        channel,
        confirmedVersion: undefined,
        version: '0.3.12'
      })
    )
  }
})

test('refuses production without a confirmation', () => {
  for (const confirmedVersion of [undefined, '']) {
    assert.throws(
      () =>
        assertProductionConfirmed({
          channel: 'primary',
          confirmedVersion,
          version: '0.3.12'
        }),
      /deliberate confirmation/
    )
  }
})

test('refuses production when the confirmed version does not match', () => {
  for (const confirmedVersion of ['0.3.11', 'y', 'yes', 'v0.3.12']) {
    assert.throws(
      () =>
        assertProductionConfirmed({
          channel: 'primary',
          confirmedVersion,
          version: '0.3.12'
        }),
      /does not match/
    )
  }
})

test('accepts production when the confirmed version matches', () => {
  assert.doesNotThrow(() =>
    assertProductionConfirmed({
      channel: 'primary',
      confirmedVersion: ' 0.3.12 ',
      version: '0.3.12'
    })
  )
})

test('dev and generic channels publish from any tree', () => {
  for (const channel of ['dev', 'generic']) {
    assert.doesNotThrow(() =>
      assertProductionSource({ channel, cleanTree: false, onRemote: false })
    )
  }
})

test('refuses production from a dirty tree', () => {
  assert.throws(
    () =>
      assertProductionSource({
        channel: 'primary',
        cleanTree: false,
        onRemote: true
      }),
    /clean tree/
  )
})

test('refuses production from an unpushed commit', () => {
  assert.throws(
    () =>
      assertProductionSource({
        channel: 'primary',
        cleanTree: true,
        onRemote: false
      }),
    /pushed commit/
  )
})

test('allows production from a clean, pushed commit', () => {
  assert.doesNotThrow(() =>
    assertProductionSource({
      channel: 'primary',
      cleanTree: true,
      onRemote: true
    })
  )
})
