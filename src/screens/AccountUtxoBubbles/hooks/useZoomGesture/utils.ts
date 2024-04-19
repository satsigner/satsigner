export const clampScale = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

export const getScaleFromDimensions = (width: number, height: number) => {
  return width > height ? (width / height) * 0.8 : (height / width) * 0.8;
};
