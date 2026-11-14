import assert from 'node:assert/strict'
import test from 'node:test'

import { libraryPermissions, permissionStatus } from './permission-check.mjs'

test('sorts permissions into allowed, blocked and unexpected', () => {
  assert.equal(permissionStatus('android.permission.CAMERA'), 'allowed')
  assert.equal(permissionStatus('android.permission.RECORD_AUDIO'), 'blocked')
  assert.equal(permissionStatus('android.permission.READ_SMS'), 'unexpected')
  assert.equal(
    permissionStatus('com.example.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'),
    'allowed'
  )
})

test('every permission a native dependency declares is allowed or blocked', () => {
  const permissions = libraryPermissions()
  assert.ok(permissions.length > 0, 'no dependency manifest was found')
  const unknown = permissions.filter(
    (permission) => permission.status === 'unexpected'
  )
  assert.deepEqual(unknown, [])
})
