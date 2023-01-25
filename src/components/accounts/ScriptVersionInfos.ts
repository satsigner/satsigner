import { ScriptVersionInfo } from "./ScriptVersionInfo";
import { ScriptVersion } from "../../enums/ScriptVersion";

const scriptVersionInfos: ScriptVersionInfo[] = [
  {
    scriptVersion: ScriptVersion.P2PKH,
    shortName: 'P2PKH',
    longName: 'Legacy',
    description: 'To solve this script, the owner of the hashed public key above needs to privide the original public key, along with a valid signature for it.',
    scriptCode: 'sh(wpkh(Key))'
  },
  {
    scriptVersion: ScriptVersion.P2SH,
    shortName: 'P2SH',
    longName: 'Nested Segwit',
    description: 'Addresses start with a "3". From this format, we can\'t distinguish whether they are MultiSig addresses or Segregated Witness.',
    scriptCode: 'sh(wpkh(Key))'
  },
  {
    scriptVersion: ScriptVersion.P2WPKH,
    shortName: 'P2WPKH',
    longName: 'Native Segwit',
    description: 'Native Segwit To solve this script, the owner of the hashed public key above needs to privide the original public key, along with a valid signature for it.',
    scriptCode: 'sh(wpkh(Key))'
  },
  {
    scriptVersion: ScriptVersion.P2TR,
    shortName: 'P2TR',
    longName: 'Taproot',
    description: 'Taproot To solve this script, the owner of the hashed public key above needs to privide the original public key, along with a valid signature for it.',
    scriptCode: 'sh(wpkh(Key))'
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
