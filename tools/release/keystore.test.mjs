import assert from 'node:assert/strict'
import test from 'node:test'

import { privateKeyFromMnemonic, privateKeysMatch } from './keystore.mjs'

const PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

test('the same 12 words rebuild the same android key', () => {
  const first = privateKeyFromMnemonic(PHRASE)
  const second = privateKeyFromMnemonic(`  ${PHRASE.toUpperCase()}  `)
  assert.equal(
    first.key.export({ format: 'der', type: 'pkcs8' }).toString('hex'),
    second.key.export({ format: 'der', type: 'pkcs8' }).toString('hex')
  )
  assert.equal(first.password, second.password)
  assert.equal(first.password.length > 20, true)
})

test('a different valid phrase is not the same key', () => {
  const first = privateKeyFromMnemonic(PHRASE)
  const other = privateKeyFromMnemonic(
    'legal winner thank year wave sausage worth useful legal winner thank yellow'
  )
  assert.equal(privateKeysMatch(first.key, first.key), true)
  assert.equal(privateKeysMatch(first.key, other.key), false)
})

test('rejects a phrase that is not 12 valid words', () => {
  assert.throws(
    () => privateKeyFromMnemonic('not a real phrase'),
    /12 valid words/
  )
})
