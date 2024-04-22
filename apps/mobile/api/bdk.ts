import { Mnemonic } from 'bdk-rn'

import { type Account } from '@/types/models/Account'

async function generateMnemonic(count: NonNullable<Account['seedWordCount']>) {
  const mnemonic = await new Mnemonic().create(count)
  return mnemonic.asString().split(' ')
}

export { generateMnemonic }
