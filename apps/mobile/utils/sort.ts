function compareTimestamp(date1?: Date, date2?: Date) {
  if (!date1 || !date2) return 0
  return date1.getTime() - date2.getTime()
}

function compareAmount(amount1: number, amount2: number) {
  return amount1 - amount2
}

export { compareAmount, compareTimestamp }
