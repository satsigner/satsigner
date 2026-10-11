import { getSankeyLinkEndId } from '@/utils/sankeyLinkEnd'

describe('getSankeyLinkEndId', () => {
  it('reads the id of a laid-out node end', () => {
    expect(getSankeyLinkEndId({ id: 'block-1-0' })).toBe('block-1-0')
  })

  it('returns an id end as is', () => {
    expect(getSankeyLinkEndId('vout-2-0')).toBe('vout-2-0')
  })

  it('stringifies a node index end', () => {
    expect(getSankeyLinkEndId(3)).toBe('3')
  })
})
