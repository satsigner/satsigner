import type { CreationType, Secret } from '@/types/models/Account'
import { assertNever } from '@/utils/assertNever'

type KeyDraftSecret = Pick<
  Secret,
  | 'extendedPublicKey'
  | 'externalDescriptor'
  | 'internalDescriptor'
  | 'mnemonic'
  | 'passphrase'
  | 'privateKey'
  | 'privateKeyCompressed'
>

/**
 * The builder keeps one draft for every key slot, so a field may still hold a
 * value from an earlier key. Only the fields that belong to this kind of key
 * may reach its secret: a WIF key must never carry a mnemonic, for example.
 */
function pickKeyDraftSecret(
  creationType: CreationType | undefined,
  draft: KeyDraftSecret
): KeyDraftSecret {
  if (!creationType) {
    return draft
  }
  const descriptors = {
    externalDescriptor: draft.externalDescriptor,
    internalDescriptor: draft.internalDescriptor
  }
  switch (creationType) {
    case 'generateMnemonic':
    case 'importMnemonic': {
      return {
        ...descriptors,
        extendedPublicKey: draft.extendedPublicKey,
        mnemonic: draft.mnemonic,
        passphrase: draft.passphrase
      }
    }
    case 'importDescriptor':
    case 'importExtendedPub': {
      return { ...descriptors, extendedPublicKey: draft.extendedPublicKey }
    }
    case 'importWif': {
      return {
        externalDescriptor: draft.externalDescriptor,
        privateKey: draft.privateKey,
        privateKeyCompressed: draft.privateKeyCompressed
      }
    }
    case 'importAddress': {
      return { externalDescriptor: draft.externalDescriptor }
    }
    default: {
      return assertNever(creationType)
    }
  }
}

export { type KeyDraftSecret, pickKeyDraftSecret }
