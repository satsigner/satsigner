import { ScriptVersionInfo } from "./ScriptVersionInfo";
import { ScriptVersion } from "../../enums/ScriptVersion";

const scriptVersionInfos: ScriptVersionInfo[] = [
  {
    scriptVersion: ScriptVersion.P2PKH,
    abbreviatedName: 'P2PKH',
    name: 'Legacy',
    descriptor: 'bip44'
  },
  {
    scriptVersion: ScriptVersion.P2SH_P2WPKH,
    abbreviatedName: 'P2SH-P2WPKH',
    name: 'Nested Segwit',
    descriptor: 'bip49'
  },
  {
    scriptVersion: ScriptVersion.P2WPKH,
    abbreviatedName: 'P2WPKH',
    name: 'Native Segwit',
    descriptor: 'bip84'
  },
  {
    scriptVersion: ScriptVersion.P2TR,
    abbreviatedName: 'P2TR',
    name: 'Taproot',
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
    return `${info?.name} (${info?.abbreviatedName})`;
  }
};
