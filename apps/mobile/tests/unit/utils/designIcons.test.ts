import { sortDesignIconGroups, toDesignIconRows } from '@/utils/designIcons'

const GROUPS = [
  {
    icons: [{ name: 'Zero' }, { name: 'Add' }, { name: 'Lock' }],
    key: 'actions'
  },
  {
    icons: [{ name: 'Seed' }, { name: 'Bitcoin' }],
    key: 'bitcoin'
  }
]

describe('sortDesignIconGroups', () => {
  it('sorts icons alphabetically inside each group and keeps group order', () => {
    const sorted = sortDesignIconGroups(GROUPS)

    expect(sorted.map((group) => group.key)).toStrictEqual([
      'actions',
      'bitcoin'
    ])
    expect(sorted[0].icons.map((icon) => icon.name)).toStrictEqual([
      'Add',
      'Lock',
      'Zero'
    ])
    expect(sorted[1].icons.map((icon) => icon.name)).toStrictEqual([
      'Bitcoin',
      'Seed'
    ])
  })

  it('does not mutate the input groups', () => {
    sortDesignIconGroups(GROUPS)

    expect(GROUPS[0].icons[0].name).toBe('Zero')
  })
})

describe('toDesignIconRows', () => {
  it('emits a header per group followed by rows chunked by column count', () => {
    const rows = toDesignIconRows(GROUPS, 2)

    expect(rows.map((row) => row.type)).toStrictEqual([
      'header',
      'icons',
      'icons',
      'header',
      'icons'
    ])
    expect(rows[0]).toMatchObject({ count: 3, groupKey: 'actions' })
    expect(rows[2]).toMatchObject({ icons: [{ name: 'Zero' }] })
  })

  it('gives every row a unique key', () => {
    const keys = toDesignIconRows(GROUPS, 1).map((row) => row.key)

    expect(new Set(keys).size).toBe(keys.length)
  })
})
