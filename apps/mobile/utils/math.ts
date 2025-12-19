/**
 * Applies logarithmic attenuation to a value to create a visually pleasing scaling effect.
 * This is particularly useful for visualizing data with large value ranges, as it compresses
 * the high end of the scale while maintaining detail in the lower ranges.
 */
export const logAttenuation = (
  value: number,
  intensity: number = 0.6
): number => {
  if (value <= 0) {
    return 0
  }
  return Math.log(value + 1) ** (1 / intensity)
}
