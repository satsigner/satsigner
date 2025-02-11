import { type Rectangle } from '@/types/ui/geometry'

function isOverlapping(rect1: Rectangle, rect2: Rectangle) {
  if (rect1.right < rect2.left || rect2.right < rect1.left) return false
  return !(rect1.bottom < rect2.top || rect2.bottom < rect1.top)
}

export { isOverlapping }
