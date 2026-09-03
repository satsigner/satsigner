import { type EcashProof } from '@/types/models/Ecash'
import {
  proofsAfterMelt,
  proofsAfterSend,
  removeSpentSecrets
} from '@/utils/ecashProofs'

function proof(secret: string, amount: number, mintUrl: string): EcashProof {
  return { C: `C-${secret}`, amount, id: 'ks', mintUrl, secret }
}

describe('ecash proof accounting', () => {
  it('replaces swapped inputs with keep after send', () => {
    const mintA = 'https://mint-a.example'
    const mintB = 'https://mint-b.example'
    const allProofs = [proof('in-8', 8, mintA), proof('other', 4, mintB)]
    const keep = [proof('keep-3', 3, mintA)]

    const remaining = proofsAfterSend(allProofs, mintA, keep)

    expect(remaining).toStrictEqual([proof('other', 4, mintB), ...keep])
  })

  it('clears a mint when send keep is empty', () => {
    const mintA = 'https://mint-a.example'
    const allProofs = [proof('a', 4, mintA), proof('b', 1, mintA)]

    const remaining = proofsAfterSend(allProofs, mintA, [])

    expect(remaining).toStrictEqual([])
  })

  it('keeps melt leftover plus change', () => {
    const mintA = 'https://mint-a.example'
    const allProofs = [proof('in-8', 8, mintA)]
    const keep = [proof('keep-3', 3, mintA)]
    const change = [proof('chg-1', 1, mintA)]

    const remaining = proofsAfterMelt(allProofs, mintA, keep, change)

    expect(remaining.map((p) => p.secret).toSorted()).toStrictEqual([
      'chg-1',
      'keep-3'
    ])
  })

  it('removes only spent secrets', () => {
    const mintA = 'https://mint-a.example'
    const allProofs = [proof('spent', 2, mintA), proof('live', 3, mintA)]

    const remaining = removeSpentSecrets(allProofs, ['spent'])

    expect(remaining).toStrictEqual([proof('live', 3, mintA)])
  })
})
