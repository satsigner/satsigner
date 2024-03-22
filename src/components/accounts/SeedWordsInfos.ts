import { SeedWordsInfo } from "./SeedWordsInfo";
import { SeedWordCount } from "../../enums/SeedWordCount";

const seedWordsInfos: SeedWordsInfo[] = [
  {
    seedWordCount: SeedWordCount.WORDS24,
    name: '24 words',
    description: '24 words generated from 256 bits of entropy.',
  },
  {
    seedWordCount: SeedWordCount.WORDS21,
    name: '21 words',
    description: '21 words generated from 224 bits of entropy.  For potentially increased computational security, consider using 24 words for new accounts.',
  },
  {
    seedWordCount: SeedWordCount.WORDS18,
    name: '18 words',
    description: '18 words generated from 192 bits of entropy.  For potentially increased computational security, consider using 24 words for new accounts.',
  },
  {
    seedWordCount: SeedWordCount.WORDS15,
    name: '15 words',
    description: '15 words generated from 160 bits of entropy.  For potentially increased computational security, consider using 24 words for new accounts.',
  },
  {
    seedWordCount: SeedWordCount.WORDS12,
    name: '12 words',
    description: '12 words generated from 128 bits of entropy.  For potentially increased computational security, consider using 24 words for new accounts.',
  }
];

export const SeedWordsInfos = {
  get: (count: SeedWordCount) => {
    return seedWordsInfos.find(swi => swi.seedWordCount === count);
  },

  getAll: () => {
    return seedWordsInfos;
  },

  getName: (count: SeedWordCount) => {
    const info = seedWordsInfos.find(swi => swi.seedWordCount === count);
    return info?.name || '';
  }
};
