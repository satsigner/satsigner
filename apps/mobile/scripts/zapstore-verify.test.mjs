import assert from 'node:assert/strict'
import test from 'node:test'

import { describeStatus, isLive, parseZspEvents } from './zapstore-verify.mjs'

const APP = {
  id: 'app-id',
  kind: 32267,
  tags: [['d', 'com.satsigner.satsigner.dev.branch']]
}
const RELEASE = { id: 'release-id', kind: 30063, tags: [] }
const ASSET = {
  id: 'asset-id',
  kind: 3063,
  tags: [['url', 'https://cdn.zapstore.dev/abc']]
}
const EVENTS = [APP, RELEASE, ASSET]
const ALL_SAVED = new Set(EVENTS.map((event) => event.id))

test('reads only the event lines zsp prints', () => {
  const lines = [
    '  some log line',
    JSON.stringify(APP),
    '{"error":"no id here"}',
    '{"kind":1,"id":',
    `  ${JSON.stringify(ASSET)}  `,
    ''
  ]
  assert.deepEqual(
    parseZspEvents(lines).map((event) => event.id),
    ['app-id', 'asset-id']
  )
})

test('a release is live only when every event is saved and the apk downloads', () => {
  assert.equal(isLive(EVENTS, { apkStatus: 200, savedIds: ALL_SAVED }), true)
  assert.equal(isLive(EVENTS, { apkStatus: 404, savedIds: ALL_SAVED }), false)
  assert.equal(
    isLive(EVENTS, { apkStatus: 200, savedIds: new Set(['app-id']) }),
    false
  )
  assert.equal(
    isLive(EVENTS, {
      apkStatus: 200,
      savedIds: new Set(['app-id', 'asset-id'])
    }),
    false
  )
})

test('the status names each missing piece and the store page', () => {
  const text = describeStatus(EVENTS, {
    apkStatus: 404,
    apkUrl: 'https://cdn.zapstore.dev/abc',
    savedIds: new Set(['app-id'])
  })
  assert.match(text, /ok {6}App listing {2}app-id/)
  assert.match(text, /missing Release {6}release-id/)
  assert.match(text, /missing https:\/\/cdn\.zapstore\.dev\/abc \(HTTP 404\)/)
  assert.match(
    text,
    /Store page: https:\/\/zapstore\.dev\/apps\/com\.satsigner\.satsigner\.dev\.branch/
  )
})
