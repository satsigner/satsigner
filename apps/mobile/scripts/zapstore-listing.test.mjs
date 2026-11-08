import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  listingImages,
  publishConfig,
  readListing
} from './zapstore-listing.mjs'

test('keeps image files in name order', () => {
  assert.deepEqual(
    listingImages([
      '02-send.PNG',
      '.gitkeep',
      'notes.txt',
      '01-home.png',
      '03.webp'
    ]),
    ['01-home.png', '02-send.PNG', '03.webp']
  )
})

test('points the config at the local APK and repository', () => {
  assert.deepEqual(
    JSON.parse(
      publishConfig({
        apkPath: '/tmp/app.apk',
        description: 'About: "Satsigner"\nline two',
        images: ['/tmp/01.png'],
        repository: 'https://github.com/satsigner/satsigner',
        summary: 'Self-custody signer'
      })
    ),
    {
      description: 'About: "Satsigner"\nline two',
      images: ['/tmp/01.png'],
      release_source: '/tmp/app.apk',
      repository: 'https://github.com/satsigner/satsigner',
      summary: 'Self-custody signer'
    }
  )
})

test('leaves out an empty summary, description and no images', () => {
  assert.deepEqual(
    JSON.parse(
      publishConfig({
        apkPath: '/tmp/app.apk',
        description: '',
        images: [],
        repository: 'https://github.com/satsigner/satsigner',
        summary: ''
      })
    ),
    {
      release_source: '/tmp/app.apk',
      repository: 'https://github.com/satsigner/satsigner'
    }
  )
})

test('reads the summary, description and screenshots from a listing folder', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'listing-'))
  try {
    mkdirSync(path.join(dir, 'screenshots'))
    writeFileSync(path.join(dir, 'description.md'), '\nHello\n\n')
    writeFileSync(path.join(dir, 'summary.txt'), 'Short\n')
    writeFileSync(path.join(dir, 'screenshots', 'b.png'), '')
    writeFileSync(path.join(dir, 'screenshots', 'a.jpg'), '')
    writeFileSync(path.join(dir, 'screenshots', '.gitkeep'), '')
    assert.deepEqual(readListing(dir), {
      description: 'Hello',
      images: [
        path.join(dir, 'screenshots', 'a.jpg'),
        path.join(dir, 'screenshots', 'b.png')
      ],
      summary: 'Short'
    })
  } finally {
    rmSync(dir, { force: true, recursive: true })
  }
})

test('reads an empty listing when the folder is missing', () => {
  assert.deepEqual(readListing(path.join(tmpdir(), 'no-such-listing')), {
    description: '',
    images: [],
    summary: ''
  })
})
