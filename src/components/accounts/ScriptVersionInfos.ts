import { ScriptVersionInfo } from "./ScriptVersionInfo";
import { ScriptVersion } from "../../enums/ScriptVersion";

const scriptVersionInfos: ScriptVersionInfo[] = [
  {
    scriptVersion: ScriptVersion.P2PKH,
    shortName: 'P2PKH',
    longName: 'Legacy',
    description: 'To solve this script, the owner of the hashed public key above needs to privide the original public key, along with a valid signature for it.'
  },
  {
    scriptVersion: ScriptVersion.P2SH,
    shortName: 'P2SH',
    longName: 'Nested Segwit',
    description: 'To solve this script, the owner of the hashed public key above needs to privide the original public key, along with a valid signature for it.'  
  },
  {
    scriptVersion: ScriptVersion.P2WPKH,
    shortName: 'P2WPKH',
    longName: 'Native Segwit',
    description: 'To solve this script, the owner of the hashed public key above needs to privide the original public key, along with a valid signature for it.'
  },
  {
    scriptVersion: ScriptVersion.P2TR,
    shortName: 'P2TR',
    longName: 'Taproot',
    description: 'To solve this script, the owner of the hashed public key above needs to privide the original public key, along with a valid signature for it.'
  }
];

export const ScriptVersionInfos = {
  getAll: () => {
    return scriptVersionInfos;
  },

  getName: (scriptVersion: ScriptVersion) => {
    const info = scriptVersionInfos.find(svi => svi.scriptVersion === scriptVersion);
    return `${info?.longName} (${info?.shortName})`;
  }
};
