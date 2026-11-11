import { type ScriptVersionType } from '@/types/models/Script'
import { parseMultisigDescriptor } from '@/utils/multisigDescriptor'

import {
  COSIGNERS,
  P2SH_MULTISIG_DESCRIPTOR,
  P2SH_P2WSH_MULTISIG_DESCRIPTOR,
  P2WSH_MULTISIG_DESCRIPTOR
} from './multisigDescriptorSamples'

type WrapperCase = {
  derivationPath: string
  descriptor: string
  keyType: 'p2sh' | 'p2shP2wsh' | 'p2wsh'
  scriptVersion: ScriptVersionType
}

const WRAPPER_CASES: WrapperCase[] = [
  {
    derivationPath: '45h/1h/0h',
    descriptor: P2SH_MULTISIG_DESCRIPTOR,
    keyType: 'p2sh',
    scriptVersion: 'P2SH'
  },
  {
    derivationPath: '48h/1h/0h/1h',
    descriptor: P2SH_P2WSH_MULTISIG_DESCRIPTOR,
    keyType: 'p2shP2wsh',
    scriptVersion: 'P2SH-P2WSH'
  },
  {
    derivationPath: '48h/1h/0h/2h',
    descriptor: P2WSH_MULTISIG_DESCRIPTOR,
    keyType: 'p2wsh',
    scriptVersion: 'P2WSH'
  }
]

describe('parseMultisigDescriptor', () => {
  it.each(WRAPPER_CASES)(
    'reads a $scriptVersion descriptor',
    ({ derivationPath, descriptor, keyType, scriptVersion }) => {
      const parsed = parseMultisigDescriptor(descriptor)

      expect(parsed.scriptVersion).toBe(scriptVersion)
      expect(parsed.keysRequired).toBe(2)
      expect(parsed.keyCount).toBe(COSIGNERS.length)
      expect(parsed.keyData).toStrictEqual(
        COSIGNERS.map((cosigner) => ({
          addressPath: '/<0;1>/*',
          derivationPath,
          extendedPublicKey: cosigner[keyType],
          fingerprint: cosigner.fingerprint
        }))
      )
    }
  )

  it('rejects a multisig without a script wrapper', () => {
    const bare = P2WSH_MULTISIG_DESCRIPTOR.replace(/^wsh\((.*)\)#\w+$/, '$1')

    expect(() => parseMultisigDescriptor(bare)).toThrow(
      'Unsupported multisig script'
    )
  })

  it('rejects a nested descriptor missing a closing parenthesis', () => {
    const truncated = P2SH_P2WSH_MULTISIG_DESCRIPTOR.replace(/\)#\w+$/, '')

    expect(() => parseMultisigDescriptor(truncated)).toThrow(
      'Invalid multisig descriptor format'
    )
  })

  it.each(['0', '4'])(
    'rejects a threshold of %s for three keys',
    (threshold) => {
      const descriptor = P2WSH_MULTISIG_DESCRIPTOR.replace(
        'sortedmulti(2,',
        `sortedmulti(${threshold},`
      )

      expect(() => parseMultisigDescriptor(descriptor)).toThrow(
        'Invalid multisig threshold'
      )
    }
  )

  it('rejects a key without its origin', () => {
    const descriptor = P2WSH_MULTISIG_DESCRIPTOR.replace(
      '[73c5da0a/48h/1h/0h/2h]',
      ''
    )

    expect(() => parseMultisigDescriptor(descriptor)).toThrow(
      'Invalid key format at index 0'
    )
  })
})
