type DesignIconGroup<Icon extends { name: string }> = {
  key: string
  icons: Icon[]
}

export type DesignIconRow<Icon extends { name: string }> =
  | { type: 'header'; key: string; groupKey: string; count: number }
  | { type: 'icons'; key: string; icons: Icon[] }

function compareByName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name)
}

export function sortDesignIconGroups<Icon extends { name: string }>(
  groups: DesignIconGroup<Icon>[]
): DesignIconGroup<Icon>[] {
  return groups.map((group) => ({
    ...group,
    icons: group.icons.toSorted(compareByName)
  }))
}

function chunk<Item>(items: Item[], size: number): Item[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size)
  )
}

export function toDesignIconRows<Icon extends { name: string }>(
  groups: DesignIconGroup<Icon>[],
  columns: number
): DesignIconRow<Icon>[] {
  return sortDesignIconGroups(groups).flatMap((group) => [
    {
      count: group.icons.length,
      groupKey: group.key,
      key: `header-${group.key}`,
      type: 'header' as const
    },
    ...chunk(group.icons, columns).map((icons, index) => ({
      icons,
      key: `${group.key}-${index}`,
      type: 'icons' as const
    }))
  ])
}
