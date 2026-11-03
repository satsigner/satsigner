import { createInterface } from 'node:readline'

import { hasReleaseKeystore, keystorePath, phraseMatchesKeystore } from './keystore.mjs'

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

if (!hasReleaseKeystore()) {
  console.error(`No release keystore at ${keystorePath}`)
  process.exit(1)
}

const phrase = await readPhrase('12 words: ')

try {
  const matches = phraseMatchesKeystore(phrase)
  if (!matches) {
    console.error('These words do not match the release keystore.')
    process.exit(1)
  }
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

console.log('These words match the release keystore.')
