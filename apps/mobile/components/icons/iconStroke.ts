export type IconStrokeProps = {
  /** Line width in screen pixels, whatever size the icon is drawn at. */
  screenStrokeWidth?: number
}

export function getIconStrokeProps(
  screenStrokeWidth: number | undefined,
  defaultStrokeWidth = 1
) {
  if (screenStrokeWidth === undefined) {
    return { strokeWidth: defaultStrokeWidth }
  }
  return {
    strokeWidth: screenStrokeWidth,
    vectorEffect: 'non-scaling-stroke' as const
  }
}
