/**
 * Applies logarithmic attenuation to a value to create a visually pleasing scaling effect.
 * This is particularly useful for visualizing data with large value ranges, as it compresses
 * the high end of the scale while maintaining detail in the lower ranges.
 *
 * @param value - The input value to attenuate
 * @returns The attenuated value, where:
 *          - Values <= 0 return 0
 *          - Positive values are transformed using log(value + 1) raised to the power of (1/intensity)
 *          - The intensity parameter (0.6) controls the compression rate
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
