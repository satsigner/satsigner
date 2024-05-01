import { Descriptor, DescriptorSecretKey, Mnemonic } from 'bdk-rn'
import { KeychainKind, Network } from 'bdk-rn/lib/lib/enums'

import { type Account } from '@/types/models/Account'

async function generateMnemonic(count: NonNullable<Account['seedWordCount']>) {
  const mnemonic = await new Mnemonic().create(count)
  return mnemonic.asString().split(' ')
}

async function validateMnemonic(seedWords: NonNullable<Account['seedWords']>) {
  try {
    await new Mnemonic().fromString(seedWords.join(' '))
  } catch (_) {
    return false
  }
  return true
}

async function parseDescriptor(descriptor: Descriptor) {
  const descriptorString = await descriptor.asString()
  const match = descriptorString.match(/\[([0-9a-f]+)([0-9'/]+)\]/)

  return match
    ? { fingerprint: match[1], derivationPath: `m${match[2]}` }
    : { fingerprint: '', derivationPath: '' }
}

async function getFingerprint(
  seedWords: NonNullable<Account['seedWords']>,
  passphrase?: Account['passphrase']
) {
  const mnemonic = await new Mnemonic().fromString(seedWords.join(' '))
  const descriptorSecretKey = await new DescriptorSecretKey().create(
    Network.Testnet, // TODO: change
    mnemonic,
    passphrase
  )
  const descriptor = await new Descriptor().newBip84(
    descriptorSecretKey,
    KeychainKind.External,
    Network.Testnet // TODO: change
  )

  const { fingerprint } = await parseDescriptor(descriptor)
  return fingerprint
}

export { generateMnemonic, getFingerprint, parseDescriptor, validateMnemonic }
