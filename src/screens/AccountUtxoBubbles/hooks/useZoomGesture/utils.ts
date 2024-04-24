export const clampScale = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};
