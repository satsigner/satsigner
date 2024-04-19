import {
  SkRect,
  Matrix4,
  SkPoint,
  multiply4,
  scale,
  translate
} from '@shopify/react-native-skia';

const MIN_SCALE = 0.8;
const MAX_SCALE = 5;

const scaleClampDiff = (value: number, min: number, max: number) => {
  'worklet';

  let diff = min - value;
  if (diff > 0) {
    return min / value;
  }

  diff = max - value;
  if (diff < 0) {
    return max / value;
  }

  return 1;
};

const clampDiff = (value: number, min: number, max: number) => {
  'worklet';

  let diff = min - value;
  if (diff > 0) {
    return diff;
  }

  diff = max - value;
  if (diff < 0) {
    return diff;
  }

  return 0;
};

export const clampMatrix = (
  aspectRect: SkRect,
  imageRect: SkRect,
  imageScale: number,
  matrix: Matrix4,
  origin: SkPoint
) => {
  'worklet';

  const scaleDiff = scaleClampDiff(matrix[0], MIN_SCALE, MAX_SCALE);
  if (scaleDiff !== 1) {
    matrix = multiply4(scale(scaleDiff, scaleDiff, 1, origin), matrix);
  }

  const s = matrix[0];

  const maxX = aspectRect.x;
  const minX = maxX + aspectRect.width - imageRect.width * imageScale * s;
  const diffX = clampDiff(matrix[3], minX, maxX);

  const maxY = aspectRect.y;
  const minY = maxY + aspectRect.height - imageRect.height * imageScale * s;
  const diffY = clampDiff(matrix[7], minY, maxY);

  if (diffX !== 0 || diffY !== 0) {
    matrix = multiply4(translate(diffX, diffY), matrix);
  }

  return matrix;
};
