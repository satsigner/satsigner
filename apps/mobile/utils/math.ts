export const logAttenuation = (value: number): number => {
  const intensity = 0.7
  if (value <= 0) {
    return 0
  }
  return Math.log(value + 1) ** (1 / intensity)
}
