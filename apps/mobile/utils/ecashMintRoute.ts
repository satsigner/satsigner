export type MintSpendBalance = {
  mintUrl: string
  balance: number
  supportsMpp: boolean
}

export type MppSlice = {
  mintUrl: string
  amountSats: number
}

export type MintRoute =
  | { kind: 'single'; mintUrl: string }
  | { kind: 'mpp'; slices: MppSlice[] }
  | { kind: 'insufficient' }
  | { kind: 'no_mpp' }

export function allocateMppSlices(
  amountSats: number,
  mints: MintSpendBalance[]
): MppSlice[] | null {
  const capable = mints
    .filter((mint) => mint.supportsMpp && mint.balance > 0)
    .toSorted((a, b) => b.balance - a.balance)

  const slices: MppSlice[] = []
  let remaining = amountSats

  for (const mint of capable) {
    if (remaining <= 0) {
      break
    }
    const take = Math.min(mint.balance, remaining)
    if (take <= 0) {
      continue
    }
    slices.push({ amountSats: take, mintUrl: mint.mintUrl })
    remaining -= take
  }

  if (remaining > 0 || slices.length === 0) {
    return null
  }

  return slices
}

export function selectMintRoute({
  amountSats,
  selectedMintUrl,
  mints,
  allowMpp
}: {
  amountSats: number
  selectedMintUrl: string | null
  mints: MintSpendBalance[]
  allowMpp: boolean
}): MintRoute {
  if (amountSats <= 0) {
    return { kind: 'insufficient' }
  }

  if (selectedMintUrl) {
    const selected = mints.find((mint) => mint.mintUrl === selectedMintUrl)
    if (selected && selected.balance >= amountSats) {
      return { kind: 'single', mintUrl: selected.mintUrl }
    }
  }

  const covering = mints
    .filter((mint) => mint.balance >= amountSats)
    .toSorted((a, b) => b.balance - a.balance)

  if (covering[0]) {
    return { kind: 'single', mintUrl: covering[0].mintUrl }
  }

  const total = mints.reduce((sum, mint) => sum + mint.balance, 0)
  if (total < amountSats) {
    return { kind: 'insufficient' }
  }

  if (!allowMpp) {
    return { kind: 'insufficient' }
  }

  const slices = allocateMppSlices(amountSats, mints)
  if (!slices) {
    return { kind: 'no_mpp' }
  }

  return { kind: 'mpp', slices }
}
