import { createInterface } from 'node:readline'

import {
  createMnemonic,
  hasReleaseKeystore,
  keystorePath,
  writeKeystore
} from './keystore.mjs'

const restore = process.argv.includes('--restore')
const force = process.argv.includes('--force')

function readPhrase(question) {
  const input = createInterface({
    input: process.stdin,
    output: process.stdout
  })
  return new Promise((resolve) => {
    input.question(question, (answer) => {
      input.close()
      resolve(answer)
    })
  })
}

if (hasReleaseKeystore() && !force) {
  console.error(`A release keystore already exists at ${keystorePath}`)
  console.error('Pass --force to replace it. Replacing it starts a new app.')
  process.exit(1)
}

const phrase = restore
  ? await readPhrase('12 words: ')
  : createMnemonic()

writeKeystore(phrase)

if (!restore) {
  console.log(phrase)
  console.log('')
  console.log('Write these 12 words down. They are the only backup of this Android key.')
  console.log('They are not your Nostr key. Losing them means this package id cannot be updated.')
}

console.log(`Keystore: ${keystorePath}`)
