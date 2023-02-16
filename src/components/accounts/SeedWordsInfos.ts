import { SeedWordsInfo } from "./SeedWordsInfo";
import { SeedWords } from "../../enums/SeedWords";

const seedWordsInfos: SeedWordsInfo[] = [
  {
    seedWords: SeedWords.WORDS24,
    name: '24 words',
    description: '24 words generated from 256 bits of entropy.',
  },
  {
    seedWords: SeedWords.WORDS21,
    name: '21 words',
    description: '21 words generated from 224 bits of entropy.  For potentially increased computational security, consider using 24 words for new accounts.',
  },
  {
    seedWords: SeedWords.WORDS18,
    name: '18 words',
    description: '18 words generated from 192 bits of entropy.  For potentially increased computational security, consider using 24 words for new accounts.',
  },
  {
    seedWords: SeedWords.WORDS15,
    name: '15 words',
    description: '15 words generated from 160 bits of entropy.  For potentially increased computational security, consider using 24 words for new accounts.',
  },
  {
    seedWords: SeedWords.WORDS12,
    name: '12 words',
    description: '12 words generated from 128 bits of entropy.  For potentially increased computational security, consider using 24 words for new accounts.',
  }
];

export const SeedWordsInfos = {
  get: (seedWords: SeedWords) => {
    return seedWordsInfos.find(svi => svi.seedWords === seedWords);
  },

  getAll: () => {
    return seedWordsInfos;
  },

  getName: (seedWords: SeedWords) => {
    const info = seedWordsInfos.find(svi => svi.seedWords === seedWords);
    return info?.name || '';
  }
};
