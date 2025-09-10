import { convertMnemonic, type WordList, WORDLIST_LIST } from '@/utils/bip39'

const test: Record<WordList, string> = {
  chinese_simplified: '摘 惩 括 冬 贤 忙 息 债 户 孔 觉 虾',
  chinese_traditional: '摘 懲 括 冬 賢 忙 息 債 戶 孔 覺 蝦',
  czech:
    'zasunout vyhledat letadlo palec vzchopit ohnisko lord vyslovit odliv letmo kometa slovo',
  english:
    'visual turtle fruit movie useful man ghost unlock long fun evolve scrub',
  french:
    'utopie thorax évaluer lombric tribunal jetable exulter tournage intense éventail écureuil problème',
  italian:
    'vano trapano ghisa onice ulisse nafta gravoso tulipano motivato gilda fare sbadiglio',
  japanese:
    'よっか めいえん さほう だんな やちん たいほ しあさって もちろん たいうん さます ごかい はけん',
  korean:
    '행복 플라스틱 사랑 연휴 한글 야간 삼십 학기 아흔 사모님 벌금 조미료',
  portuguese:
    'usina teto espreita liderar tratador isento exibir torrada inovador esquerda direto predador',
  spanish:
    'vale tórax fraude mochila trozo malla ganso tregua lonja freno entrar rapto'
}

describe('Mnemonic word list conversion', () => {
  for (const wordList of WORDLIST_LIST) {
    it(`converts from ${wordList} into english`, () => {
      const converted = convertMnemonic(test[wordList], 'english', wordList)
      expect(converted).toEqual(test['english'])
    })

    it(`converts from english into ${wordList}`, () => {
      const converted = convertMnemonic(test['english'], wordList, 'english')
      expect(converted).toEqual(test[wordList])
    })
  }
})
