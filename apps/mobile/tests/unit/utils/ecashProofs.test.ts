import { PRIVACY_MASK } from '@/constants/privacy'
import { type EcashProof } from '@/types/models/Ecash'
import {
  ecashProofsToBubbleData,
  proofsAfterMelt,
  proofsAfterSend,
  removeSpentSecrets
} from '@/utils/ecashProofs'
import { formatNumber } from '@/utils/format'

function proof(secret: string, amount: number, mintUrl: string): EcashProof {
  return { C: `C-${secret}`, amount, id: 'ks', mintUrl, secret }
}

describe('ecash proof accounting', () => {
  it('replaces swapped inputs with keep after send', () => {
    const mintA = 'https://mint-a.example'
    const mintB = 'https://mint-b.example'
    const allProofs = [proof('in-8', 8, mintA), proof('other', 4, mintB)]
    const keep = [proof('keep-3', 3, mintA)]

    const remaining = proofsAfterSend(
      allProofs,
      [proof('in-8', 8, mintA)],
      keep
    )

    expect(remaining).toStrictEqual([proof('other', 4, mintB), ...keep])
  })

  it('clears a mint when send keep is empty', () => {
    const mintA = 'https://mint-a.example'
    const allProofs = [proof('a', 4, mintA), proof('b', 1, mintA)]

    const remaining = proofsAfterSend(allProofs, allProofs, [])

    expect(remaining).toStrictEqual([])
  })

  it('keeps melt leftover plus change', () => {
    const mintA = 'https://mint-a.example'
    const allProofs = [proof('in-8', 8, mintA)]
    const keep = [proof('keep-3', 3, mintA)]
    const change = [proof('chg-1', 1, mintA)]

    const remaining = proofsAfterMelt(
      allProofs,
      [proof('in-8', 8, mintA)],
      keep,
      change
    )

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

  it('preserves proofs added while a send is pending', () => {
    const mintA = 'https://mint-a.example'
    const remaining = proofsAfterSend(
      [proof('in', 8, mintA), proof('new', 1, mintA)],
      [proof('in', 8, mintA)],
      [proof('keep', 3, mintA)]
    )

    expect(remaining.map((item) => item.secret).toSorted()).toStrictEqual([
      'keep',
      'new'
    ])
  })
})

describe('ecashProofsToBubbleData', () => {
  const mint = 'https://mint.example'

  it('maps each proof to its index, amount and formatted label', () => {
    const proofs = [proof('a', 1000, mint), proof('b', 42, mint)]

    expect(ecashProofsToBubbleData(proofs, false)).toStrictEqual([
      { id: '0', label: formatNumber(1000), value: 1000 },
      { id: '1', label: formatNumber(42), value: 42 }
    ])
  })

  it('masks labels in privacy mode but keeps the value', () => {
    const data = ecashProofsToBubbleData([proof('a', 1000, mint)], true)

    expect(data[0]).toStrictEqual({
      id: '0',
      label: PRIVACY_MASK,
      value: 1000
    })
  })
})
