import {
  LIGHTNING_BUBBLE_CHART_FIT_MARGIN_FRAC,
  LIGHTNING_BUBBLE_CHART_HUB_RADIUS_FRAC_OF_MIN_HALF,
  LIGHTNING_BUBBLE_CHART_HUB_RADIUS_MAX_PX,
  LIGHTNING_BUBBLE_CHART_HUB_RADIUS_MIN_PX,
  LIGHTNING_BUBBLE_CHART_HIT_PAD_PX,
  LIGHTNING_BUBBLE_CHART_LABEL_OFFSET_PERP_PX,
  LIGHTNING_BUBBLE_CHART_LABEL_OUTWARD_PAST_REMOTE_PX,
  LIGHTNING_BUBBLE_CHART_MAX_LOCAL_BUBBLE_PX,
  LIGHTNING_BUBBLE_CHART_MAX_REMOTE_BUBBLE_PX,
  LIGHTNING_BUBBLE_CHART_MIN_LOCAL_BUBBLE_PX,
  LIGHTNING_BUBBLE_CHART_MIN_REMOTE_BUBBLE_PX,
  LIGHTNING_BUBBLE_CHART_PADDING_PX,
  LIGHTNING_BUBBLE_CHART_SPOKE_GAP_PX
} from '@/constants/lightningChannelsBubbleChart'

export type LightningBubbleChannelRow = {
  chanId: string
  localSats: number
  remoteSats: number
  peerLabel: string
}

export type LightningBubbleCircle = {
  cx: number
  cy: number
  r: number
}

export type LightningBubbleSpoke = {
  x1: number
  y1: number
  x2: number
  y2: number
}

export type LightningBubbleLayoutChannel = {
  angleRad: number
  chanId: string
  hitSlop: { height: number; left: number; top: number; width: number }
  label: { x: number; y: number }
  local: LightningBubbleCircle
  localSats: number
  peerLabel: string
  remote: LightningBubbleCircle
  remoteSats: number
  spoke: LightningBubbleSpoke
  ux: number
  uy: number
}

export type LightningBubbleLayoutHub = {
  cx: number
  cy: number
  radius: number
  totalInboundSats: number
  totalOutboundSats: number
}

export type LightningBubbleLayoutResult = {
  canvasHeight: number
  canvasWidth: number
  channels: LightningBubbleLayoutChannel[]
  hub: LightningBubbleLayoutHub
}

export function scaleBubbleRadius(
  valueSats: number,
  maxSats: number,
  minR: number,
  maxR: number
): number {
  if (valueSats <= 0 || maxSats <= 0) {
    return minR
  }
  const t = Math.sqrt(Math.min(1, valueSats / maxSats))
  return minR + t * (maxR - minR)
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function maxReachForChannel(
  hubR: number,
  rLocal: number,
  rRemote: number,
  spokeGap: number
): number {
  return hubR + 2 * rLocal + spokeGap + 2 * rRemote
}

export function buildLightningChannelsBubbleLayout(
  rows: LightningBubbleChannelRow[],
  canvasWidth: number,
  canvasHeight: number
): LightningBubbleLayoutResult | null {
  if (rows.length === 0) {
    return null
  }

  const cx = canvasWidth / 2
  const cy = canvasHeight / 2
  const halfMin =
    Math.min(canvasWidth, canvasHeight) / 2 - LIGHTNING_BUBBLE_CHART_PADDING_PX
  const availableR = Math.max(
    40,
    halfMin * LIGHTNING_BUBBLE_CHART_FIT_MARGIN_FRAC
  )

  let hubR = clamp(
    halfMin * LIGHTNING_BUBBLE_CHART_HUB_RADIUS_FRAC_OF_MIN_HALF,
    LIGHTNING_BUBBLE_CHART_HUB_RADIUS_MIN_PX,
    LIGHTNING_BUBBLE_CHART_HUB_RADIUS_MAX_PX
  )

  const maxLocalSats = Math.max(0, ...rows.map((r) => Math.max(0, r.localSats)))
  const maxRemoteSats = Math.max(
    0,
    ...rows.map((r) => Math.max(0, r.remoteSats))
  )

  const n = rows.length
  const rLocals: number[] = []
  const rRemotes: number[] = []
  for (let i = 0; i < n; i += 1) {
    const row = rows[i]
    rLocals.push(
      scaleBubbleRadius(
        row.localSats,
        maxLocalSats,
        LIGHTNING_BUBBLE_CHART_MIN_LOCAL_BUBBLE_PX,
        LIGHTNING_BUBBLE_CHART_MAX_LOCAL_BUBBLE_PX
      )
    )
    rRemotes.push(
      scaleBubbleRadius(
        row.remoteSats,
        maxRemoteSats,
        LIGHTNING_BUBBLE_CHART_MIN_REMOTE_BUBBLE_PX,
        LIGHTNING_BUBBLE_CHART_MAX_REMOTE_BUBBLE_PX
      )
    )
  }

  let gap = LIGHTNING_BUBBLE_CHART_SPOKE_GAP_PX
  let maxReach = 0
  for (let i = 0; i < n; i += 1) {
    const reach = maxReachForChannel(hubR, rLocals[i], rRemotes[i], gap)
    maxReach = Math.max(maxReach, reach)
  }

  if (maxReach > availableR && maxReach > 0) {
    const factor = availableR / maxReach
    hubR *= factor
    gap *= factor
    for (let i = 0; i < n; i += 1) {
      rLocals[i] *= factor
      rRemotes[i] *= factor
    }
  }

  const totalInboundSats = rows.reduce(
    (s, r) => s + Math.max(0, r.remoteSats),
    0
  )
  const totalOutboundSats = rows.reduce(
    (s, r) => s + Math.max(0, r.localSats),
    0
  )

  const hub: LightningBubbleLayoutHub = {
    cx,
    cy,
    radius: hubR,
    totalInboundSats,
    totalOutboundSats
  }

  const channels: LightningBubbleLayoutChannel[] = []

  for (let i = 0; i < n; i += 1) {
    const row = rows[i]
    const angleRad = -Math.PI / 2 + (2 * Math.PI * i) / n
    const ux = Math.cos(angleRad)
    const uy = Math.sin(angleRad)
    const px = -uy
    const py = ux

    const rL = rLocals[i]
    const rR = rRemotes[i]

    const localCx = cx + ux * (hubR + rL)
    const localCy = cy + uy * (hubR + rL)

    const remoteCx = cx + ux * (hubR + 2 * rL + gap + rR)
    const remoteCy = cy + uy * (hubR + 2 * rL + gap + rR)

    const spokeStartX = cx + ux * (hubR + 2 * rL)
    const spokeStartY = cy + uy * (hubR + 2 * rL)
    const spokeEndX = cx + ux * (hubR + 2 * rL + gap)
    const spokeEndY = cy + uy * (hubR + 2 * rL + gap)

    const labelOutward =
      rR + LIGHTNING_BUBBLE_CHART_LABEL_OUTWARD_PAST_REMOTE_PX
    const midX =
      remoteCx +
      ux * labelOutward +
      px * LIGHTNING_BUBBLE_CHART_LABEL_OFFSET_PERP_PX
    const midY =
      remoteCy +
      uy * labelOutward +
      py * LIGHTNING_BUBBLE_CHART_LABEL_OFFSET_PERP_PX

    const minX =
      Math.min(localCx - rL, remoteCx - rR) - LIGHTNING_BUBBLE_CHART_HIT_PAD_PX
    const maxX =
      Math.max(localCx + rL, remoteCx + rR) + LIGHTNING_BUBBLE_CHART_HIT_PAD_PX
    const minY =
      Math.min(localCy - rL, remoteCy - rR) - LIGHTNING_BUBBLE_CHART_HIT_PAD_PX
    const maxY =
      Math.max(localCy + rL, remoteCy + rR) + LIGHTNING_BUBBLE_CHART_HIT_PAD_PX

    channels.push({
      angleRad,
      chanId: row.chanId,
      hitSlop: {
        height: maxY - minY,
        left: minX,
        top: minY,
        width: maxX - minX
      },
      label: { x: midX, y: midY },
      local: { cx: localCx, cy: localCy, r: rL },
      localSats: row.localSats,
      peerLabel: row.peerLabel,
      remote: { cx: remoteCx, cy: remoteCy, r: rR },
      remoteSats: row.remoteSats,
      spoke: {
        x1: spokeStartX,
        x2: spokeEndX,
        y1: spokeStartY,
        y2: spokeEndY
      },
      ux,
      uy
    })
  }

  return {
    canvasHeight,
    canvasWidth,
    channels,
    hub
  }
}
