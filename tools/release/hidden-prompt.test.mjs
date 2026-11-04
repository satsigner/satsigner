import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import test from 'node:test'

import { readHiddenLine } from './hidden-prompt.mjs'

const WORDS =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

function collect(stream) {
  const chunks = []
  stream.on('data', (chunk) => chunks.push(chunk.toString()))
  return () => chunks.join('')
}

test('reads the words from a terminal without echoing them', async () => {
  const input = new PassThrough()
  input.isTTY = true
  const output = new PassThrough()
  const printed = collect(output)
  const answer = readHiddenLine('12 words: ', input, output)
  input.write(`${WORDS}\r`)
  assert.equal(await answer, WORDS)
  assert.equal(printed(), '12 words: \n')
})

test('reads the words from a pipe', async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  const printed = collect(output)
  const answer = readHiddenLine('12 words: ', input, output)
  input.end(`${WORDS}\n`)
  assert.equal(await answer, WORDS)
  assert.equal(printed().includes('abandon'), false)
})
