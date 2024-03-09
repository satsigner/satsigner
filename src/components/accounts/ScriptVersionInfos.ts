import { ScriptVersionInfo } from "./ScriptVersionInfo";
import { ScriptVersion } from "../../enums/ScriptVersion";

const scriptVersionInfos: ScriptVersionInfo[] = [
  {
    scriptVersion: ScriptVersion.P2PKH,
    shortName: 'P2PKH',
    longName: 'Pay to Pubkey Hash',
    description: 'To solve this script, the owner of the hashed public key above needs to provide the original public key, along with a valid signature for it.',
    descriptor: 'bip44'
  },
  {
    scriptVersion: ScriptVersion.P2WPKH_NESTED_IN_P2SH,
    shortName: 'P2WPKH-in-P2SH',
    longName: 'Nested Segwit',
    description: 'Addresses start with a "3". From this format, we can\'t distinguish whether they are MultiSig addresses or Segregated Witness compatible addresses. P2SH is the abbreviation of "Pay To Script Hash" and lorem ipsum.',
    descriptor: 'bip49'
  },
  {
    scriptVersion: ScriptVersion.P2WPKH,
    shortName: 'P2WPKH',
    longName: 'Native Segwit',
    description: 'Native Segwit To solve this script, the owner of the hashed public key above needs to provide the original public key, along with a valid signature for it.',
    descriptor: 'bip84'
  },
  {
    scriptVersion: ScriptVersion.P2TR,
    shortName: 'P2TR',
    longName: 'Taproot',
    description: 'Taproot To solve this script, the owner of the hashed public key above needs to provide the original public key, along with a valid signature for it.',
    descriptor: 'p2tr'
  }
];

export const ScriptVersionInfos = {
  get: (scriptVersion: ScriptVersion) => {
    return scriptVersionInfos.find(svi => svi.scriptVersion === scriptVersion);
  },

  getAll: () => {
    return scriptVersionInfos;
  },

  getName: (scriptVersion: ScriptVersion) => {
    const info = scriptVersionInfos.find(svi => svi.scriptVersion === scriptVersion);
    return `${info?.longName} (${info?.shortName})`;
  }
};
