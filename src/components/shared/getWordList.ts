import * as bip39 from 'bip39';

export default function getWordList(): string[] {
  const name = bip39.getDefaultWordlist();
  return bip39.wordlists[name];
}
