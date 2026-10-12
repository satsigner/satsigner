import { router } from 'expo-router'

/** Import/generate callbacks for `SSMultisigKeyControl`, opening each flow for key `index`. */
export function multisigKeyImportHandlers(index: number) {
  return {
    onGenerateMnemonic: () =>
      router.navigate(
        `/signer/bitcoin/account/add/multiSig/keySettings/${index}`
      ),
    onImportDescriptor: () =>
      router.navigate(
        `/signer/bitcoin/account/add/(common)/import/descriptor/${index}`
      ),
    onImportExtendedPub: () =>
      router.navigate(
        `/signer/bitcoin/account/add/(common)/import/extendedPub/${index}`
      ),
    onImportMnemonic: () =>
      router.navigate(`/signer/bitcoin/account/add/import/mnemonic/${index}`)
  }
}
