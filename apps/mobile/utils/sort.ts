function compareTimestamp(date1?: Date | string, date2?: Date | string) {
  if (!date1 || !date2) return 0
  return new Date(date1).getTime() - new Date(date2).getTime()
}

function compareAmount(amount1: number, amount2: number) {
  return amount1 - amount2
}

export { compareAmount, compareTimestamp }
