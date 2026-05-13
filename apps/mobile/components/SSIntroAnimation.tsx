import { hierarchy, pack } from "d3";
import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import SSButton from "@/components/SSButton";
import SSSignSendSankeyIllustration from "@/components/SSSignSendSankeyIllustration";
import SSText from "@/components/SSText";
import { t } from "@/locales";
import { Colors, Typography } from "@/styles";

// Visual constants
const LOGO_SIZE = 140;
const LOGO_FONT_SIZE = 21;
const LOGO_LETTER_SPACING = 4;
const LOGO_FONT_LINE_HEIGHT = 23;
const HEX_FONT_SIZE = 12;
const HEX_LINE_HEIGHT = Math.round(HEX_FONT_SIZE * 1.28);
const HEX_LEFT_PADDING = 8;
/** First row top (fraction of screen height); spacing uses `HEX_ROW_GAP_FRAC`. */
const HEX_ROW_TOP_FRAC = 0.1;
const HEX_ROW_GAP_FRAC = 0.028;
/** Full opacity for each hex line (reveal still fades rows in via `p`). */
const HEX_LINE_BASE_OPACITY = 0.42;
// Hex dump — Bitcoin genesis block (285 B) as xxd-style offset + hex + ASCII (16 bytes / line)
const GENESIS_BLOCK_HEX_ROWS = [
  {
    text: "00000000  01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   |................|",
  },
  {
    text: "00000010  00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   |................|",
  },
  {
    text: "00000020  00 00 00 00 3b a3 ed fd 7a 7b 12 b2 7a c7 2c 3e   |....;...z{..z.,>|",
  },
  {
    text: "00000030  67 76 8f 61 7f c8 1b c3 88 8a 51 32 3a 9f b8 aa   |gv.a......Q2:...|",
  },
  {
    text: "00000040  4b 1e 5e 4a 29 ab 5f 49 ff ff 00 1d 1d ac 2b 7c   |K.^J)._I......+||",
  },
  {
    text: "00000050  01 01 00 00 00 01 00 00 00 00 00 00 00 00 00 00   |................|",
  },
  {
    text: "00000060  00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   |................|",
  },
  {
    text: "00000070  00 00 00 00 00 00 ff ff ff ff 4d 04 ff ff 00 1d   |..........M.....|",
  },
  {
    text: "00000080  01 04 45 54 68 65 20 54 69 6d 65 73 20 30 33 2f   |..EThe Times 03/|",
  },
  {
    text: "00000090  4a 61 6e 2f 32 30 30 39 20 43 68 61 6e 63 65 6c   |Jan/2009 Chancel|",
  },
  {
    text: "000000a0  6c 6f 72 20 6f 6e 20 62 72 69 6e 6b 20 6f 66 20   |lor on brink of |",
  },
  {
    text: "000000b0  73 65 63 6f 6e 64 20 62 61 69 6c 6f 75 74 20 66   |second bailout f|",
  },
  {
    text: "000000c0  6f 72 20 62 61 6e 6b 73 ff ff ff ff 01 00 f2 05   |or banks........|",
  },
  {
    text: "000000d0  2a 01 00 00 00 43 41 04 67 8a fd b0 fe 55 48 27   |*....CA.g....UH'|",
  },
  {
    text: "000000e0  19 67 f1 a6 71 30 b7 10 5c d6 a8 28 e0 39 09 a6   |.g..q0..\\..(.9..|",
  },
  {
    text: "000000f0  79 62 e0 ea 1f 61 de b6 49 f6 bc 3f 4c ef 38 c4   |yb...a..I..?L.8.|",
  },
  {
    text: "00000100  f3 55 04 e5 1e c1 12 de 5c 38 4d f7 ba 0b 8d 57   |.U......\\8M....W|",
  },
  {
    text: "00000110  8a 4c 70 2b 6b f1 1d 5f ac 00 00 00 00            |.Lp+k.._.....   |",
  },
] as const;

const GENESIS_ROW_COUNT = GENESIS_BLOCK_HEX_ROWS.length;

type GenesisHexTitleKey =
  | "intro.steps.genesisHex.coinbaseOutpointIndex"
  | "intro.steps.genesisHex.coinbasePrevTxid"
  | "intro.steps.genesisHex.headerTimeBitsNonce"
  | "intro.steps.genesisHex.inputSequence"
  | "intro.steps.genesisHex.locktime"
  | "intro.steps.genesisHex.merkleRoot"
  | "intro.steps.genesisHex.outputCountAndValue"
  | "intro.steps.genesisHex.previousBlockHash"
  | "intro.steps.genesisHex.scriptPubKey"
  | "intro.steps.genesisHex.scriptSig"
  | "intro.steps.genesisHex.txHeader"
  | "intro.steps.genesisHex.version";

/** Inclusive byte ranges — full 0..284 partition of the 285 B genesis dump. */
const GENESIS_HEX_HIGHLIGHTS = [
  { byteEnd: 3, byteStart: 0, titleKey: "intro.steps.genesisHex.version" },
  {
    byteEnd: 35,
    byteStart: 4,
    titleKey: "intro.steps.genesisHex.previousBlockHash",
  },
  { byteEnd: 67, byteStart: 36, titleKey: "intro.steps.genesisHex.merkleRoot" },
  {
    byteEnd: 79,
    byteStart: 68,
    titleKey: "intro.steps.genesisHex.headerTimeBitsNonce",
  },
  { byteEnd: 85, byteStart: 80, titleKey: "intro.steps.genesisHex.txHeader" },
  {
    byteEnd: 117,
    byteStart: 86,
    titleKey: "intro.steps.genesisHex.coinbasePrevTxid",
  },
  {
    byteEnd: 121,
    byteStart: 118,
    titleKey: "intro.steps.genesisHex.coinbaseOutpointIndex",
  },
  { byteEnd: 199, byteStart: 122, titleKey: "intro.steps.genesisHex.scriptSig" },
  {
    byteEnd: 203,
    byteStart: 200,
    titleKey: "intro.steps.genesisHex.inputSequence",
  },
  {
    byteEnd: 212,
    byteStart: 204,
    titleKey: "intro.steps.genesisHex.outputCountAndValue",
  },
  {
    byteEnd: 280,
    byteStart: 213,
    titleKey: "intro.steps.genesisHex.scriptPubKey",
  },
  { byteEnd: 284, byteStart: 281, titleKey: "intro.steps.genesisHex.locktime" },
] as const satisfies readonly {
  byteEnd: number;
  byteStart: number;
  titleKey: GenesisHexTitleKey;
}[];

const DOT_SIZE = 6;
const DOT_GAP = 8;
const STEP_COUNT = 11;
const MIN_BOTTOM_PADDING = 24;

// Step transition timing (ms / px)
const TRANSITION_MS = 320;
const SLIDE_OUT_OFFSET = -24;
const SLIDE_IN_OFFSET = 32;
const TEXT_SLIDE_DELAY = 40;
const DESC_SLIDE_DELAY = 90;

// Hex step — uniform fade (all lines at once; easing from hexRowFadeIn)
const HEX_REVEAL_MS = 420;

function hexRowFadeIn(t: number) {
  "worklet";
  if (t <= 0) {
    return 0;
  }
  if (t >= 1) {
    return 1;
  }
  if (t < 0.5) {
    return 4 * t * t * t;
  }
  return 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const HEX_COL_HEX0 = 10;
const HEX_COL_GAP0 = 57;
const HEX_COL_PIPE1 = 60;
const HEX_COL_ASCII0 = 61;
const HEX_COL_PIPE2 = 77;

/** Time between hex highlight hops (instant handoff, no fade). */
const HEX_HIGHLIGHT_STEP_MS = 160;

function genesisBytesInRow(rowIndex: number): number {
  return rowIndex === GENESIS_ROW_COUNT - 1 ? 13 : 16;
}

function genesisRowFirstGlobalByte(rowIndex: number): number {
  return rowIndex * 16;
}

type RowByteSpan = { j0: number; j1: number };

function intersectHighlightInRow(
  rowIndex: number,
  byteStart: number,
  byteEnd: number
): RowByteSpan | null {
  const row0 = genesisRowFirstGlobalByte(rowIndex);
  const n = genesisBytesInRow(rowIndex);
  const rowLast = row0 + n - 1;
  const lo = Math.max(byteStart, row0);
  const hi = Math.min(byteEnd, rowLast);
  if (lo > hi) {
    return null;
  }
  return { j0: lo - row0, j1: hi - row0 };
}

type TextPart = { hl: boolean; text: string };

function pushMerged(out: TextPart[], text: string, hl: boolean) {
  if (text.length === 0) {
    return;
  }
  const prev = out[out.length - 1];
  if (prev && prev.hl === hl) {
    prev.text += text;
  } else {
    out.push({ hl, text });
  }
}

function hexCharSpanInLine(j0: number, j1: number, bytesInRow: number) {
  const start = HEX_COL_HEX0 + j0 * 3;
  const endExclusive =
    HEX_COL_HEX0 + j1 * 3 + (j1 < bytesInRow - 1 ? 3 : 2);
  return { endExclusive, start };
}

function buildGenesisRowTextParts(
  line: string,
  rowIndex: number,
  highlight: (typeof GENESIS_HEX_HIGHLIGHTS)[number] | null
): TextPart[] {
  const out: TextPart[] = [];
  const bytesInRow = genesisBytesInRow(rowIndex);
  const span = highlight
    ? intersectHighlightInRow(
        rowIndex,
        highlight.byteStart,
        highlight.byteEnd
      )
    : null;

  pushMerged(out, line.slice(0, HEX_COL_HEX0), false);

  const hexEnd =
    bytesInRow > 0 ? HEX_COL_HEX0 + bytesInRow * 3 - 1 : HEX_COL_HEX0;
  const hexSlice = line.slice(HEX_COL_HEX0, hexEnd);

  if (!span) {
    pushMerged(out, hexSlice, false);
  } else {
    const { j0, j1 } = span;
    const { endExclusive: hEnd, start: hStart } = hexCharSpanInLine(
      j0,
      j1,
      bytesInRow
    );
    const rel0 = hStart - HEX_COL_HEX0;
    const rel1Exc = hEnd - HEX_COL_HEX0;
    pushMerged(out, hexSlice.slice(0, rel0), false);
    pushMerged(out, hexSlice.slice(rel0, rel1Exc), true);
    pushMerged(out, hexSlice.slice(rel1Exc), false);
  }

  pushMerged(out, line.slice(hexEnd, HEX_COL_PIPE1 + 1), false);

  const asciiSlice = line.slice(HEX_COL_ASCII0, HEX_COL_PIPE2);
  if (!span) {
    pushMerged(out, asciiSlice, false);
  } else {
    const { j0, j1 } = span;
    pushMerged(out, asciiSlice.slice(0, j0), false);
    pushMerged(out, asciiSlice.slice(j0, j1 + 1), true);
    pushMerged(out, asciiSlice.slice(j1 + 1), false);
  }

  pushMerged(out, line.slice(HEX_COL_PIPE2), false);
  return out;
}

const { 200: BUBBLE_COLOR_BRIGHT, 700: BUBBLE_COLOR_DARK } = Colors.gray;
const BUBBLE_COLOR_THRESHOLD = 0.45;

const BUBBLE_BREATHE_MAX = 1.05;
const BUBBLE_BREATHE_MS = 3000;
const UTXO_ENTER_MS = 400;
const UTXO_ENTER_STAGGER_MS = 90;
const UTXO_EXIT_MS = 320;
const UTXO_CYCLE_MS = 3000;
const UTXO_REMOVE_MAX = 2;
const UTXO_ADD_MAX = 2;
const UTXO_MIN_COUNT = 5;
const UTXO_MAX_COUNT = 12;
const UTXO_PACK_PADDING = 6;
const UTXO_REPACK_MS = 280;

// Sankey step constants (simple flow illustration)
const SANKEY_FADE_MS = 600;
const SANKEY_SCALE_START = 0.88;

// Phone frame step constants
const PHONE_SCALE_INITIAL = 0.92;
const PHONE_SCALE_TARGET = 0.68;
const PHONE_SCALE_MS = 500;
const PHONE_UI_COUNT = 5;
const PHONE_STAGGER_MS = 90;
const PHONE_FADE_MS = 280;
const PHONE_SLIDE_Y = 16;
const PHONE_FRAME_RADIUS = 32;
const PHONE_HEADER_TOP = 110;
const PHONE_HIGHLIGHT_SWEEP_MS =
  PHONE_UI_COUNT * PHONE_STAGGER_MS + PHONE_FADE_MS;
const PHONE_HIGHLIGHT_TAIL = 5; // must match 1 / fade-slope (0.20) in PhoneLayerBtn
const PHONE_HIGHLIGHT_TAIL_MS =
  PHONE_HIGHLIGHT_TAIL * (PHONE_HIGHLIGHT_SWEEP_MS / PHONE_UI_COUNT);
const PHONE_HIGHLIGHT_PAUSE_MS = 4500;

// Privacy step constants
const PRIVACY_CENTER_Y_FRACTION = 0.38;
const PRIVACY_STAGGER_MS = 88;
const PRIVACY_REVEAL_MS = 400;
const PRIVACY_FADE_STAGGER_MS = 158;
const PRIVACY_FADE_MS = 660;
const PRIVACY_FADE_OUT_OPACITY_EXP = 1.22;
const PRIVACY_PULSE_SCALE = 1.1;
const PRIVACY_PULSE_MS = 3600;
// Concentric fade is ~0..1; start rain partway through so it overlaps the tail
const PRIVACY_RAIN_START_FADE_FRACTION = 0.58;
/** Pause after a cluster fully fades before the next one (same for every cycle). */
const PRIVACY_RAIN_CYCLE_GAP_MS = 600;
const PRIVACY_RAIN_SLOT_STAGGER_MS = 1880;
const PRIVACY_RAIN_X_MARGIN = 0.1;
const PRIVACY_RAIN_Y_MIN = 0.16;
/** Max center Y as fraction of height — keep rain in upper 70% (avoid title / body copy). */
const PRIVACY_RAIN_Y_MAX = 0.7;

// Explorer step constants
const EXPLORER_BLOCK_SIZE = 36;
const EXPLORER_CONNECTOR_W = 16;
const EXPLORER_BLOCK_COUNT = 9;
const EXPLORER_CHAIN_WIDTH =
  EXPLORER_BLOCK_COUNT * EXPLORER_BLOCK_SIZE +
  (EXPLORER_BLOCK_COUNT - 1) * EXPLORER_CONNECTOR_W;
const EXPLORER_TOP_FRACTION = 0.38;
const EXPLORER_REVEAL_SCALE = 0.88;
const EXPLORER_REVEAL_MS = 550;
const EXPLORER_SCAN_MS = 2600;
const EXPLORER_SCAN_FADE_IN_PX = 10;
const EXPLORER_SCAN_FADE_OUT_PX = 72;
const EXPLORER_SCAN_EDGE_FADE_PX = 100;

// Roadmap step constants
const ROADMAP_ITEM_COUNT = 5;
const ROADMAP_STAGGER_MS = 110;
const ROADMAP_FADE_MS = 280;
const ROADMAP_SLIDE_Y = 12;
const ROADMAP_DOT_SIZE = 10;
const ROADMAP_ROW_FRACTION = 0.1;
const ROADMAP_TOP_FRACTION = 0.1;
const ROADMAP_LEFT_FRACTION = 0.22;

// Thanks step constants
const THANKS_LOGO_REVEAL_MS = 500;
const THANKS_NODE_STAGGER_MS = 70;
const THANKS_NODE_REVEAL_MS = 320;
const THANKS_BREATHE_MAX = 1.04;
const THANKS_BREATHE_MS = 3400;
const THANKS_FINALE_UI_FADE_MS = 350;
const THANKS_FINALE_DURATION_MS = 650;
const THANKS_FINALE_HOLD_MS = 500;
const THANKS_FINALE_OUT_MS = 500;

// Logo finale timing (ms)
const CIRCLE_IN_MS = 500;
const LOGO_IN_MS = 400;
const LOGO_OVERLAP_MS = 200;
const LOGO_HOLD_MS = 400;
const FADE_OUT_MS = 400;

// Returning user timing (ms)
const RETURNING_CIRCLE_IN = 400;
const RETURNING_LOGO_IN = 400;
const RETURNING_HOLD = 200;
const RETURNING_FADE_OUT = 400;
const RETURNING_LOGO_DELAY = RETURNING_CIRCLE_IN;
const RETURNING_FADE_DELAY =
  RETURNING_CIRCLE_IN + RETURNING_LOGO_IN + RETURNING_HOLD;

// Bubble chart — cx/cy = center fractions of screen; size in px; opacity drives visual weight
// Larger bubbles = larger UTXOs (dominant holdings), smaller = dust/change outputs
// UTXO value pool — used to randomly sample bubble sizes (proportional to sqrt of value)
const UTXO_VALUE_POOL = [
  900, 600, 450, 320, 250, 200, 160, 130, 100, 80, 60, 45, 35, 25, 18, 12, 8, 5,
] as const;

let _utxoBubbleIdCounter = 0;

function nextUtxoBubbleId(): number {
  const id = _utxoBubbleIdCounter;
  _utxoBubbleIdCounter += 1;
  return id;
}

// Privacy concentric rings (radius as fraction of screen width)
const RING_DEFS = [
  { opacity: 0.6, radiusFraction: 0.06 },
  { opacity: 0.42, radiusFraction: 0.15 },
  { opacity: 0.27, radiusFraction: 0.25 },
  { opacity: 0.16, radiusFraction: 0.36 },
  { opacity: 0.09, radiusFraction: 0.48 },
] as const;

function privacySmooth(t: number) {
  "worklet";
  return t * t * t * (t * (t * 6 - 15) + 10);
}

const PRIVACY_RING_ALPHA_EPS = 0.012;

function privacyRingPaint(
  breathe: number,
  index: number,
  phase: number,
  ringCount: number,
  ringOpacity: number
) {
  "worklet";
  const revealEnd = ringCount;
  const revealRaw = Math.min(
    1,
    Math.max(0, Math.min(phase, revealEnd) - index)
  );
  const revealProgress = privacySmooth(revealRaw);
  const fadeRaw = Math.min(1, Math.max(0, phase - revealEnd - index));
  const fadeProgress = privacySmooth(fadeRaw);
  const afterReveal = Math.pow(1 - fadeProgress, PRIVACY_FADE_OUT_OPACITY_EXP);
  let alpha = ringOpacity * revealProgress * afterReveal;
  if (phase + 1e-4 >= 2 * revealEnd) {
    alpha = 0;
  }
  if (alpha < PRIVACY_RING_ALPHA_EPS) {
    alpha = 0;
  }
  const scale = (0.6 + revealProgress * 0.4) * breathe;
  return {
    borderWidth: alpha === 0 ? 0 : 1,
    opacity: alpha,
    transform: [{ scale }],
  };
}

// Nostr network graph — index 0 is the central descriptor node; all devices connect to it
const NOSTR_NODES = [
  { cx: 0.5, cy: 0.38, opacity: 0.85, size: 52 }, // descriptor (center)
  { cx: 0.26, cy: 0.22, opacity: 0.64, size: 28 }, // co-signer 1
  { cx: 0.58, cy: 0.16, opacity: 0.6, size: 24 }, // co-signer 2
  { cx: 0.74, cy: 0.28, opacity: 0.58, size: 26 }, // co-signer 3
  { cx: 0.76, cy: 0.48, opacity: 0.52, size: 22 }, // relay
  { cx: 0.6, cy: 0.56, opacity: 0.5, size: 20 }, // local agent
  { cx: 0.34, cy: 0.54, opacity: 0.46, size: 18 }, // co-signer 4
  { cx: 0.22, cy: 0.42, opacity: 0.42, size: 16 }, // relay
] as const;

// All device nodes connect to the descriptor (index 0)
const NOSTR_EDGES = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],
  [0, 7],
] as const;

const NOSTR_NODE_REVEAL_MS = 350;
const NOSTR_NODE_STAGGER_MS = 120;
const NOSTR_EDGE_FADE_MS = 600;
const NOSTR_PULSE_MS = 3400;
const NOSTR_PULSE_MIN = 0.78;

// Roadmap milestones — filled = shipped, outlined = upcoming
const ROADMAP_ITEMS = [
  { done: true },
  { done: true },
  { done: true },
  { done: false },
  { done: false },
] as const;

// Explorer — pre-defined transaction bars per block [x, y, w, h]
const EXPLORER_TX_DEFS = [
  [
    { h: 3, w: 20, x: 3, y: 4 },
    { h: 3, w: 12, x: 3, y: 10 },
    { h: 3, w: 18, x: 3, y: 16 },
    { h: 3, w: 9, x: 3, y: 22 },
  ],
  [
    { h: 3, w: 15, x: 3, y: 4 },
    { h: 3, w: 24, x: 3, y: 10 },
    { h: 3, w: 11, x: 3, y: 16 },
    { h: 3, w: 19, x: 3, y: 22 },
    { h: 3, w: 13, x: 3, y: 28 },
  ],
  [
    { h: 3, w: 22, x: 3, y: 4 },
    { h: 3, w: 14, x: 3, y: 10 },
    { h: 3, w: 17, x: 3, y: 22 },
  ],
  [
    { h: 3, w: 11, x: 3, y: 4 },
    { h: 3, w: 21, x: 3, y: 10 },
    { h: 3, w: 16, x: 3, y: 16 },
    { h: 3, w: 25, x: 3, y: 22 },
    { h: 3, w: 8, x: 3, y: 28 },
  ],
  [
    { h: 3, w: 18, x: 3, y: 4 },
    { h: 3, w: 10, x: 3, y: 10 },
    { h: 3, w: 14, x: 3, y: 22 },
    { h: 3, w: 23, x: 3, y: 28 },
  ],
  [
    { h: 3, w: 14, x: 3, y: 4 },
    { h: 3, w: 8, x: 3, y: 10 },
    { h: 3, w: 22, x: 3, y: 16 },
    { h: 3, w: 13, x: 3, y: 22 },
    { h: 3, w: 19, x: 3, y: 28 },
  ],
  [
    { h: 3, w: 17, x: 3, y: 4 },
    { h: 3, w: 23, x: 3, y: 10 },
    { h: 3, w: 10, x: 3, y: 16 },
    { h: 3, w: 20, x: 3, y: 22 },
  ],
  [
    { h: 3, w: 25, x: 3, y: 4 },
    { h: 3, w: 13, x: 3, y: 10 },
    { h: 3, w: 15, x: 3, y: 22 },
    { h: 3, w: 9, x: 3, y: 28 },
    { h: 3, w: 18, x: 3, y: 16 },
  ],
  [
    { h: 3, w: 16, x: 3, y: 10 },
    { h: 3, w: 21, x: 3, y: 16 },
    { h: 3, w: 12, x: 3, y: 22 },
  ],
  [
    { h: 3, w: 9, x: 3, y: 4 },
    { h: 3, w: 20, x: 3, y: 10 },
    { h: 3, w: 15, x: 3, y: 16 },
    { h: 3, w: 24, x: 3, y: 22 },
    { h: 3, w: 11, x: 3, y: 28 },
  ],
  [
    { h: 3, w: 19, x: 3, y: 4 },
    { h: 3, w: 11, x: 3, y: 10 },
    { h: 3, w: 23, x: 3, y: 22 },
    { h: 3, w: 14, x: 3, y: 28 },
  ],
] as const;

// Thanks — contributor circles orbit the logo (logo center: cx=0.5, cy=0.28)
const THANKS_CONTRIBUTOR_NODES = [
  { cx: 0.5, cy: 0.16, github: "francismars", opacity: 0.88, size: 44 },
  { cx: 0.66, cy: 0.2, github: "garyray-k", opacity: 0.84, size: 40 },
  { cx: 0.72, cy: 0.28, github: "Jeezman", opacity: 0.86, size: 42 },
  { cx: 0.66, cy: 0.36, github: "tmakerman", opacity: 0.82, size: 40 },
  { cx: 0.5, cy: 0.4, github: "pedromvprg", opacity: 0.88, size: 44 },
  { cx: 0.34, cy: 0.36, github: "psycarlo1", opacity: 0.82, size: 40 },
  { cx: 0.28, cy: 0.28, github: "dergigi", opacity: 0.84, size: 42 },
  { cx: 0.34, cy: 0.2, github: "NerdNook-rgb", opacity: 0.8, size: 38 },
] as const;

// Outer orbit — larger circles for supporting organization logos
const THANKS_COMPANY_NODES = [
  { cx: 0.12, cy: 0.28, opacity: 0.55, size: 60 },
  { cx: 0.88, cy: 0.28, opacity: 0.55, size: 60 },
] as const;

const THANKS_TOTAL_NODE_COUNT =
  THANKS_CONTRIBUTOR_NODES.length + THANKS_COMPANY_NODES.length;

const STEP_CONFIGS = [
  {
    descriptionKey: "intro.steps.transactions.description" as const,
    titleKey: "intro.steps.transactions.title" as const,
  },
  {
    descriptionKey: "intro.steps.utxos.description" as const,
    titleKey: "intro.steps.utxos.title" as const,
  },
  {
    descriptionKey: "intro.steps.sign.description" as const,
    titleKey: "intro.steps.sign.title" as const,
  },
  {
    descriptionKey: "intro.steps.layers.description" as const,
    titleKey: "intro.steps.layers.title" as const,
  },
  {
    descriptionKey: "intro.steps.privacy.description" as const,
    titleKey: "intro.steps.privacy.title" as const,
  },
  {
    descriptionKey: "intro.steps.nostr.description" as const,
    titleKey: "intro.steps.nostr.title" as const,
  },
  {
    descriptionKey: "intro.steps.explorer.description" as const,
    titleKey: "intro.steps.explorer.title" as const,
  },
  {
    descriptionKey: "intro.steps.roadmap.description" as const,
    titleKey: "intro.steps.roadmap.title" as const,
  },
  {
    descriptionKey: "intro.steps.saveSpend.description" as const,
    titleKey: "intro.steps.saveSpend.title" as const,
  },
  {
    descriptionKey: "intro.steps.saveFollowup.description" as const,
    titleKey: "intro.steps.saveFollowup.title" as const,
  },
  {
    descriptionKey: "intro.steps.thanks.description" as const,
    titleKey: "intro.steps.thanks.title" as const,
  },
];

type IntroStepCopyKeys = (typeof STEP_CONFIGS)[number] | {
  descriptionKey: "intro.steps.spendFollowup.description";
  titleKey: "intro.steps.spendFollowup.title";
};

function getIntroStepCopyKeys(
  step: number,
  saveSpendChoice: "save" | "spend" | null
): IntroStepCopyKeys {
  if (step === 9) {
    const branch = saveSpendChoice ?? "save";
    if (branch === "spend") {
      return {
        descriptionKey: "intro.steps.spendFollowup.description" as const,
        titleKey: "intro.steps.spendFollowup.title" as const,
      };
    }
    return {
      descriptionKey: "intro.steps.saveFollowup.description" as const,
      titleKey: "intro.steps.saveFollowup.title" as const,
    };
  }
  return STEP_CONFIGS[step];
}

type HexRowProps = {
  highlightLead: (typeof GENESIS_HEX_HIGHLIGHTS)[number] | null;
  index: number;
  revealProgress: SharedValue<number>;
  row: (typeof GENESIS_BLOCK_HEX_ROWS)[number];
  screenHeight: number;
};

function HexRow({
  row,
  index,
  revealProgress,
  screenHeight,
  highlightLead,
}: HexRowProps) {
  const leadParts = useMemo(
    () => buildGenesisRowTextParts(row.text, index, highlightLead),
    [highlightLead, index, row.text]
  );

  const animStyle = useAnimatedStyle(() => {
    const raw = Math.min(1, Math.max(0, revealProgress.value));
    const p = hexRowFadeIn(raw);
    return {
      opacity: HEX_LINE_BASE_OPACITY * p,
    };
  });

  const top = (HEX_ROW_TOP_FRAC + index * HEX_ROW_GAP_FRAC) * screenHeight;
  const overlayTextProps = {
    adjustsFontSizeToFit: true,
    minimumFontScale: 0.78,
    numberOfLines: 1 as const,
  };

  return (
    <Animated.View style={[styles.hexText, animStyle, { top }]}>
      <Text
        {...overlayTextProps}
        style={[styles.hexTextOverlayLine, { color: Colors.white }]}
      >
        {row.text}
      </Text>
      {highlightLead ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <Text {...overlayTextProps} style={styles.hexTextOverlayLine}>
            {leadParts.map((part, i) =>
              part.hl ? (
                <Text key={`hex-ld-${index}-${i}`} style={styles.hexHlTint}>
                  {part.text}
                </Text>
              ) : (
                <Text key={`hex-ldn-${index}-${i}`} style={{ color: "transparent" }}>
                  {part.text}
                </Text>
              )
            )}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

type HexStreamStepProps = {
  screenHeight: number;
};

function HexStreamStep({ screenHeight }: HexStreamStepProps) {
  const revealProgress = useSharedValue(0);
  const [highlightsEnabled, setHighlightsEnabled] = useState(false);
  const [leadIndex, setLeadIndex] = useState(0);

  const revealDuration = HEX_REVEAL_MS;

  useEffect(() => {
    revealProgress.set(
      withTiming(1, {
        duration: revealDuration,
        easing: Easing.linear,
      })
    );
  }, [revealDuration, revealProgress]);

  useEffect(() => {
    const t = setTimeout(() => {
      setHighlightsEnabled(true);
    }, revealDuration);
    return () => clearTimeout(t);
  }, [revealDuration]);

  useEffect(() => {
    if (!highlightsEnabled) {
      return;
    }
    const id = setInterval(() => {
      setLeadIndex((i) => (i + 1) % GENESIS_HEX_HIGHLIGHTS.length);
    }, HEX_HIGHLIGHT_STEP_MS);
    return () => clearInterval(id);
  }, [highlightsEnabled]);

  useEffect(() => {
    return () => {
      cancelAnimation(revealProgress);
    };
  }, [revealProgress]);

  const highlightLead = highlightsEnabled
    ? GENESIS_HEX_HIGHLIGHTS[leadIndex]
    : null;

  const sectionTitle =
    highlightLead !== null ? t(highlightLead.titleKey) : null;

  const labelTop = HEX_ROW_TOP_FRAC * screenHeight - 24;

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      {sectionTitle !== null ? (
        <SSText
          center
          size="xs"
          style={[styles.hexSectionLabel, { top: labelTop }]}
        >
          {sectionTitle}
        </SSText>
      ) : null}
      {GENESIS_BLOCK_HEX_ROWS.map((row, i) => (
        <HexRow
          key={`genesis-hex-${i}`}
          row={row}
          index={i}
          revealProgress={revealProgress}
          screenHeight={screenHeight}
          highlightLead={highlightLead}
        />
      ))}
    </View>
  );
}

type LiveUtxoBubble = {
  enterDelay: number;
  exiting: boolean;
  id: number;
  value: number;
};

type PackedUtxoBubble = {
  color: string;
  cx: number;
  cy: number;
  enterDelay: number;
  exiting: boolean;
  id: number;
  r: number;
};

type BubblePackDatum = {
  children?: BubblePackDatum[];
  id: number;
  value: number;
};

function computePackedBubbles(
  bubbles: LiveUtxoBubble[],
  screenWidth: number,
  screenHeight: number
): PackedUtxoBubble[] {
  if (bubbles.length === 0) {
    return [];
  }

  const packW = screenWidth * 0.9;
  const packH = screenHeight * 0.48;
  const offsetX = (screenWidth - packW) / 2;
  const offsetY = screenHeight * 0.12;

  const root = hierarchy<BubblePackDatum>({
    children: bubbles.map((b) => ({ id: b.id, value: b.value })),
    id: -1,
    value: 0,
  })
    .sum((d) => d.value)
    // eslint-disable-next-line unicorn/no-array-sort -- toSorted not supported in Hermes
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const packer = pack<BubblePackDatum>()
    .size([packW, packH])
    .padding(UTXO_PACK_PADDING);
  const leaves = packer(root).leaves();
  const maxR = Math.max(...leaves.map((l) => l.r), 1);

  return leaves.map((leaf) => {
    const bubble = bubbles.find((b) => b.id === leaf.data.id)!;
    return {
      color:
        leaf.r / maxR >= BUBBLE_COLOR_THRESHOLD
          ? BUBBLE_COLOR_BRIGHT
          : BUBBLE_COLOR_DARK,
      cx: leaf.x + offsetX,
      cy: leaf.y + offsetY,
      enterDelay: bubble.enterDelay,
      exiting: bubble.exiting,
      id: leaf.data.id,
      r: leaf.r,
    };
  });
}

type LiveBubbleItemProps = {
  color: string;
  cx: number;
  cy: number;
  enterDelay: number;
  exiting: boolean;
  id: number;
  onExited: (id: number) => void;
  r: number;
};

function LiveBubbleItem({
  id,
  cx,
  cy,
  r,
  color,
  enterDelay,
  exiting,
  onExited,
}: LiveBubbleItemProps) {
  const scaleAnim = useSharedValue(0);
  const xAnim = useSharedValue(cx);
  const yAnim = useSharedValue(cy);
  const breathe = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: xAnim.value - r },
      { translateY: yAnim.value - r },
      { scale: scaleAnim.value * breathe.value },
    ],
  }));

  useEffect(() => {
    scaleAnim.set(
      withDelay(
        enterDelay,
        withTiming(
          1,
          { duration: UTXO_ENTER_MS, easing: Easing.out(Easing.cubic) },
          () => {
            breathe.set(
              withDelay(
                (id % 12) * 370,
                withRepeat(
                  withTiming(BUBBLE_BREATHE_MAX, {
                    duration: BUBBLE_BREATHE_MS + (id % 8) * 60,
                    easing: Easing.inOut(Easing.sin),
                  }),
                  -1,
                  true
                )
              )
            );
          }
        )
      )
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (exiting) {
      breathe.set(withTiming(1, { duration: 80 }));
      scaleAnim.set(
        withTiming(
          0,
          { duration: UTXO_EXIT_MS, easing: Easing.in(Easing.cubic) },
          () => {
            runOnJS(onExited)(id);
          }
        )
      );
    }
  }, [exiting]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    xAnim.set(
      withTiming(cx, {
        duration: UTXO_REPACK_MS,
        easing: Easing.inOut(Easing.quad),
      })
    );
    yAnim.set(
      withTiming(cy, {
        duration: UTXO_REPACK_MS,
        easing: Easing.inOut(Easing.quad),
      })
    );
  }, [cx, cy]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[
        styles.bubble,
        animStyle,
        {
          backgroundColor: color,
          borderRadius: r,
          height: r * 2,
          left: 0,
          top: 0,
          width: r * 2,
        },
      ]}
    />
  );
}

type BubbleStepProps = {
  screenHeight: number;
  screenWidth: number;
};

function BubbleStep({ screenWidth, screenHeight }: BubbleStepProps) {
  const initialBubbles = useRef<LiveUtxoBubble[] | null>(null);
  if (!initialBubbles.current) {
    // Sort descending so largest bubble appears first, smaller ones follow
    const picked = [...UTXO_VALUE_POOL]
      // eslint-disable-next-line unicorn/no-array-sort -- toSorted not supported in Hermes
      .sort(() => Math.random() - 0.5)
      .slice(0, 9)
      // eslint-disable-next-line unicorn/no-array-sort -- toSorted not supported in Hermes
      .sort((a, b) => b - a);
    initialBubbles.current = picked.map((value, index) => ({
      enterDelay: index * UTXO_ENTER_STAGGER_MS,
      exiting: false,
      id: nextUtxoBubbleId(),
      value,
    }));
  }

  const [bubbles, setBubbles] = useState<LiveUtxoBubble[]>(
    initialBubbles.current
  );
  const packed = computePackedBubbles(bubbles, screenWidth, screenHeight);

  function handleExited(id: number) {
    setBubbles((prev) => prev.filter((b) => b.id !== id));
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setBubbles((prev) => {
        const active = prev.filter((b) => !b.exiting);
        const removeCount = Math.min(
          Math.floor(Math.random() * UTXO_REMOVE_MAX) + 1,
          Math.max(0, active.length - UTXO_MIN_COUNT)
        );
        const addCount = Math.min(
          Math.floor(Math.random() * (UTXO_ADD_MAX + 1)),
          UTXO_MAX_COUNT - (active.length - removeCount)
        );

        // eslint-disable-next-line unicorn/no-array-sort -- toSorted not supported in Hermes
        const shuffled = [...active].sort(() => Math.random() - 0.5);
        const toRemoveIds = new Set(
          shuffled.slice(0, removeCount).map((b) => b.id)
        );
        const newBubbles: LiveUtxoBubble[] = Array.from(
          { length: addCount },
          () => ({
            enterDelay: 0,
            exiting: false,
            id: nextUtxoBubbleId(),
            value:
              UTXO_VALUE_POOL[
                Math.floor(Math.random() * UTXO_VALUE_POOL.length)
              ],
          })
        );

        return [
          ...prev.map((b) =>
            toRemoveIds.has(b.id) ? { ...b, exiting: true } : b
          ),
          ...newBubbles,
        ];
      });
    }, UTXO_CYCLE_MS);

    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      {packed.map((b) => (
        <LiveBubbleItem
          key={b.id}
          id={b.id}
          cx={b.cx}
          cy={b.cy}
          r={b.r}
          color={b.color}
          enterDelay={b.enterDelay}
          exiting={b.exiting}
          onExited={handleExited}
        />
      ))}
    </View>
  );
}

type NostrNodeProps = {
  cx: number;
  cy: number;
  index: number;
  opacity: number;
  revealProgress: SharedValue<number>;
  screenHeight: number;
  screenWidth: number;
  size: number;
};

function NostrNode({
  cx,
  cy,
  size,
  opacity,
  index,
  revealProgress,
  screenWidth,
  screenHeight,
}: NostrNodeProps) {
  const breathe = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => {
    const raw = Math.min(1, Math.max(0, revealProgress.value - index));
    const smooth = raw * raw * (3 - 2 * raw);
    return {
      opacity: opacity * smooth,
      transform: [{ scale: 0.2 + smooth * 0.8 }, { scale: breathe.value }],
    };
  });

  useEffect(() => {
    breathe.set(
      withDelay(
        index * 420,
        withRepeat(
          withTiming(1.06, {
            duration: 2800 + index * 90,
            easing: Easing.inOut(Easing.sin),
          }),
          -1,
          true
        )
      )
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[
        styles.nostrNode,
        animStyle,
        {
          borderRadius: size / 2,
          height: size,
          left: cx * screenWidth - size / 2,
          top: cy * screenHeight - size / 2,
          width: size,
        },
      ]}
    />
  );
}

type NostrStepProps = {
  screenHeight: number;
  screenWidth: number;
};

function NostrStep({ screenWidth, screenHeight }: NostrStepProps) {
  const revealProgress = useSharedValue(0);
  const edgeOpacity = useSharedValue(0);
  const pulseOpacity = useSharedValue(1);

  const edgeStyle = useAnimatedStyle(() => ({ opacity: edgeOpacity.value }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  useEffect(() => {
    revealProgress.set(
      withTiming(
        NOSTR_NODES.length,
        {
          duration:
            NOSTR_NODES.length * NOSTR_NODE_STAGGER_MS + NOSTR_NODE_REVEAL_MS,
          easing: Easing.out(Easing.cubic),
        },
        () => {
          edgeOpacity.set(withTiming(1, { duration: NOSTR_EDGE_FADE_MS }));
          pulseOpacity.set(
            withRepeat(
              withTiming(NOSTR_PULSE_MIN, {
                duration: NOSTR_PULSE_MS,
                easing: Easing.inOut(Easing.sin),
              }),
              -1,
              true
            )
          );
        }
      )
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[styles.fullScreen, pulseStyle]} pointerEvents="none">
      <Animated.View
        style={[styles.fullScreen, edgeStyle]}
        pointerEvents="none"
      >
        <Svg width={screenWidth} height={screenHeight}>
          {NOSTR_EDGES.map(([from, to], i) => {
            const a = NOSTR_NODES[from];
            const b = NOSTR_NODES[to];
            return (
              <Path
                key={i}
                d={`M ${a.cx * screenWidth} ${a.cy * screenHeight} L ${
                  b.cx * screenWidth
                } ${b.cy * screenHeight}`}
                stroke="rgba(255,255,255,0.30)"
                strokeWidth={1}
              />
            );
          })}
        </Svg>
      </Animated.View>
      {NOSTR_NODES.map((node, i) => (
        <NostrNode
          key={i}
          index={i}
          cx={node.cx}
          cy={node.cy}
          size={node.size}
          opacity={node.opacity}
          revealProgress={revealProgress}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      ))}
    </Animated.View>
  );
}

type SankeyStepProps = {
  screenHeight: number;
};

function SankeyStep({ screenHeight }: SankeyStepProps) {
  const chartOpacity = useSharedValue(0);
  const chartScale = useSharedValue(SANKEY_SCALE_START);

  const chartStyle = useAnimatedStyle(() => ({
    opacity: chartOpacity.value,
    transform: [{ scale: chartScale.value }],
  }));

  useEffect(() => {
    chartOpacity.set(
      withTiming(1, {
        duration: SANKEY_FADE_MS,
        easing: Easing.out(Easing.cubic),
      })
    );
    chartScale.set(
      withTiming(1, {
        duration: SANKEY_FADE_MS,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      <Animated.View
        style={[
          styles.fullScreen,
          {
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: screenHeight * 0.12,
          },
          chartStyle,
        ]}
      >
        <SSSignSendSankeyIllustration variant="minimal" />
      </Animated.View>
    </View>
  );
}

type PhoneUIElementProps = {
  children: ReactNode;
  index: number;
  uiReveal: SharedValue<number>;
};

function PhoneUIElement({ children, index, uiReveal }: PhoneUIElementProps) {
  const animStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, uiReveal.value - index));
    return {
      opacity: progress,
      transform: [{ translateY: PHONE_SLIDE_Y * (1 - progress) }],
    };
  });

  return (
    <Animated.View style={[styles.phoneUIElement, animStyle]}>
      {children}
    </Animated.View>
  );
}

type PhoneLayerBtnProps = {
  highlightWave: SharedValue<number>;
  index: number;
  label: string;
};

function PhoneLayerBtn({ label, index, highlightWave }: PhoneLayerBtnProps) {
  const borderGlowStyle = useAnimatedStyle(() => {
    const signed = highlightWave.value - index;
    const t =
      signed < 0
        ? Math.max(0, 1 + signed * 1.4)
        : Math.max(0, 1 - signed * 0.2);
    return { opacity: t * 0.7 };
  });

  const textStyle = useAnimatedStyle(() => {
    const signed = highlightWave.value - index;
    const t =
      signed < 0
        ? Math.max(0, 1 + signed * 1.4)
        : Math.max(0, 1 - signed * 0.2);
    return { opacity: 0.72 + t * 0.28 };
  });

  return (
    <View style={styles.phoneLayerBtn}>
      <Animated.View
        style={[styles.phoneLayerBtnBorder, borderGlowStyle]}
        pointerEvents="none"
      />
      <Animated.Text
        numberOfLines={1}
        style={[styles.phoneLayerBtnText, textStyle]}
      >
        {label}
      </Animated.Text>
    </View>
  );
}

const PHONE_SHADOW_FADE_IN_MS = 400;
const PHONE_SHADOW_OPACITY = 0.42;

type LayersStepProps = { stepTransition: SharedValue<number> };

function LayersStep({ stepTransition }: LayersStepProps) {
  const frameScale = useSharedValue(PHONE_SCALE_INITIAL);
  const shadowAnim = useSharedValue(0);
  const uiReveal = useSharedValue(0);
  const highlightWave = useSharedValue(-1);

  const frameStyle = useAnimatedStyle(() => ({
    shadowOpacity:
      PHONE_SHADOW_OPACITY *
      shadowAnim.value *
      Math.min(1, stepTransition.value * 3),
    transform: [{ scale: frameScale.value }],
  }));

  const contentFadeStyle = useAnimatedStyle(() => ({
    opacity: stepTransition.value,
  }));

  useEffect(() => {
    frameScale.set(
      withTiming(
        PHONE_SCALE_TARGET,
        { duration: PHONE_SCALE_MS, easing: Easing.out(Easing.cubic) },
        () => {
          shadowAnim.set(withTiming(1, { duration: PHONE_SHADOW_FADE_IN_MS }));
          uiReveal.set(
            withTiming(
              PHONE_UI_COUNT,
              {
                duration: PHONE_UI_COUNT * PHONE_STAGGER_MS + PHONE_FADE_MS,
                easing: Easing.linear,
              },
              () => {
                highlightWave.set(
                  withRepeat(
                    withSequence(
                      withDelay(
                        PHONE_HIGHLIGHT_PAUSE_MS,
                        withSequence(
                          withTiming(PHONE_UI_COUNT - 1, {
                            duration: PHONE_HIGHLIGHT_SWEEP_MS,
                            easing: Easing.linear,
                          }),
                          withTiming(
                            PHONE_UI_COUNT - 1 + PHONE_HIGHLIGHT_TAIL,
                            {
                              duration: PHONE_HIGHLIGHT_TAIL_MS,
                              easing: Easing.linear,
                            }
                          )
                        )
                      ),
                      withTiming(-1, { duration: 1 })
                    ),
                    -1,
                    false
                  )
                );
              }
            )
          );
        }
      )
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Animated.View
        style={[styles.phoneFrame, frameStyle]}
        pointerEvents="none"
      >
        <Animated.View
          style={[StyleSheet.absoluteFillObject, contentFadeStyle]}
        >
          <View style={styles.phoneBorder}>
            <PhoneUIElement index={0} uiReveal={uiReveal}>
              <PhoneLayerBtn
                label="Bitcoin"
                index={0}
                highlightWave={highlightWave}
              />
            </PhoneUIElement>
            <PhoneUIElement index={1} uiReveal={uiReveal}>
              <PhoneLayerBtn
                label="Lightning"
                index={1}
                highlightWave={highlightWave}
              />
            </PhoneUIElement>
            <PhoneUIElement index={2} uiReveal={uiReveal}>
              <PhoneLayerBtn
                label="Ark"
                index={2}
                highlightWave={highlightWave}
              />
            </PhoneUIElement>
            <PhoneUIElement index={3} uiReveal={uiReveal}>
              <PhoneLayerBtn
                label="eCash"
                index={3}
                highlightWave={highlightWave}
              />
            </PhoneUIElement>
            <PhoneUIElement index={4} uiReveal={uiReveal}>
              <PhoneLayerBtn
                label="Nostr"
                index={4}
                highlightWave={highlightWave}
              />
            </PhoneUIElement>
          </View>
        </Animated.View>
      </Animated.View>
    </>
  );
}

type RingItemProps = {
  centerX: number;
  centerY: number;
  index: number;
  opacity: number;
  radius: number;
  ringPhase: SharedValue<number>;
};

function RingItem({
  radius,
  centerX,
  centerY,
  opacity,
  index,
  ringPhase,
}: RingItemProps) {
  const breathe = useSharedValue(1);
  const ringCount = RING_DEFS.length;

  const animStyle = useAnimatedStyle(() => {
    return privacyRingPaint(
      breathe.value,
      index,
      ringPhase.value,
      ringCount,
      opacity
    );
  });

  useEffect(() => {
    const phaseDelay = index * 340;
    breathe.set(
      withDelay(
        phaseDelay,
        withRepeat(
          withTiming(PRIVACY_PULSE_SCALE, {
            duration: PRIVACY_PULSE_MS,
            easing: Easing.inOut(Easing.sin),
          }),
          -1,
          true
        )
      )
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[
        styles.ring,
        animStyle,
        {
          borderRadius: radius,
          height: radius * 2,
          left: centerX - radius,
          top: centerY - radius,
          width: radius * 2,
        },
      ]}
    />
  );
}

type ClusterRingItemProps = {
  centerX: SharedValue<number>;
  centerY: SharedValue<number>;
  index: number;
  opacity: number;
  radius: number;
  ringPhase: SharedValue<number>;
};

function ClusterRingItem({
  centerX,
  centerY,
  index,
  opacity,
  radius,
  ringPhase,
}: ClusterRingItemProps) {
  const breathe = useSharedValue(1);
  const ringCount = RING_DEFS.length;

  const animStyle = useAnimatedStyle(() => {
    const paint = privacyRingPaint(
      breathe.value,
      index,
      ringPhase.value,
      ringCount,
      opacity
    );
    return {
      ...paint,
      borderRadius: radius,
      height: radius * 2,
      left: centerX.value - radius,
      top: centerY.value - radius,
      width: radius * 2,
    };
  });

  useEffect(() => {
    const phaseDelay = index * 340;
    breathe.set(
      withDelay(
        phaseDelay,
        withRepeat(
          withTiming(PRIVACY_PULSE_SCALE, {
            duration: PRIVACY_PULSE_MS,
            easing: Easing.inOut(Easing.sin),
          }),
          -1,
          true
        )
      )
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[styles.ring, animStyle]} pointerEvents="none" />
  );
}

type PrivacyStepProps = {
  screenHeight: number;
  screenWidth: number;
};

type PrivacyRainClusterSlotProps = {
  fadeDuration: number;
  revealDuration: number;
  screenHeight: number;
  screenWidth: number;
  startAfterMs: number;
};

function PrivacyRainClusterSlot({
  fadeDuration,
  revealDuration,
  screenHeight,
  screenWidth,
  startAfterMs,
}: PrivacyRainClusterSlotProps) {
  const clusterPhase = useSharedValue(0);
  const centerX = useSharedValue(screenWidth * 0.5);
  const centerY = useSharedValue(screenHeight * 0.42);

  const unmountedRef = useRef(false);
  const firstKickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const gapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    unmountedRef.current = false;

    function scheduleAfterGap() {
      if (unmountedRef.current) {
        return;
      }
      if (gapTimeoutRef.current !== null) {
        clearTimeout(gapTimeoutRef.current);
      }
      gapTimeoutRef.current = setTimeout(() => {
        gapTimeoutRef.current = null;
        kick();
      }, PRIVACY_RAIN_CYCLE_GAP_MS);
    }

    function kick() {
      if (unmountedRef.current) {
        return;
      }
      const xFrac =
        PRIVACY_RAIN_X_MARGIN + Math.random() * (1 - 2 * PRIVACY_RAIN_X_MARGIN);
      const yFrac =
        PRIVACY_RAIN_Y_MIN +
        Math.random() * (PRIVACY_RAIN_Y_MAX - PRIVACY_RAIN_Y_MIN);
      centerX.value = screenWidth * xFrac;
      centerY.value = screenHeight * yFrac;
      cancelAnimation(clusterPhase);
      clusterPhase.value = 0;
      clusterPhase.value = withSequence(
        withTiming(RING_DEFS.length, {
          duration: revealDuration,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(
          RING_DEFS.length * 2,
          {
            duration: fadeDuration,
            easing: Easing.inOut(Easing.poly(5)),
          },
          (finished) => {
            if (finished) {
              runOnJS(scheduleAfterGap)();
            }
          }
        )
      );
    }

    firstKickTimeoutRef.current = setTimeout(() => {
      firstKickTimeoutRef.current = null;
      kick();
    }, startAfterMs);

    return () => {
      unmountedRef.current = true;
      if (firstKickTimeoutRef.current !== null) {
        clearTimeout(firstKickTimeoutRef.current);
      }
      if (gapTimeoutRef.current !== null) {
        clearTimeout(gapTimeoutRef.current);
      }
      cancelAnimation(clusterPhase);
    };
  }, [
    clusterPhase,
    centerX,
    centerY,
    fadeDuration,
    revealDuration,
    screenHeight,
    screenWidth,
    startAfterMs,
  ]);

  return (
    <View style={styles.privacyRainCluster} pointerEvents="none">
      {RING_DEFS.map((ring, i) => {
        const radius = ring.radiusFraction * screenWidth;
        return (
          <ClusterRingItem
            key={ring.radiusFraction}
            centerX={centerX}
            centerY={centerY}
            index={i}
            opacity={ring.opacity}
            radius={radius}
            ringPhase={clusterPhase}
          />
        );
      })}
    </View>
  );
}

function PrivacyStep({ screenWidth, screenHeight }: PrivacyStepProps) {
  const ringPhase = useSharedValue(0);

  const revealDuration =
    RING_DEFS.length * PRIVACY_STAGGER_MS + PRIVACY_REVEAL_MS;
  const fadeDuration =
    RING_DEFS.length * PRIVACY_FADE_STAGGER_MS + PRIVACY_FADE_MS;
  const rainStartMs =
    revealDuration + fadeDuration * PRIVACY_RAIN_START_FADE_FRACTION;

  useEffect(() => {
    ringPhase.set(
      withSequence(
        withTiming(RING_DEFS.length, {
          duration: revealDuration,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(RING_DEFS.length * 2, {
          duration: fadeDuration,
          easing: Easing.inOut(Easing.poly(5)),
        })
      )
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const centerX = screenWidth / 2;
  const centerY = screenHeight * PRIVACY_CENTER_Y_FRACTION;

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      {RING_DEFS.map((ring, i) => {
        const radius = ring.radiusFraction * screenWidth;
        return (
          <RingItem
            key={ring.radiusFraction}
            radius={radius}
            centerX={centerX}
            centerY={centerY}
            opacity={ring.opacity}
            index={i}
            ringPhase={ringPhase}
          />
        );
      })}
      <PrivacyRainClusterSlot
        fadeDuration={fadeDuration}
        revealDuration={revealDuration}
        screenHeight={screenHeight}
        screenWidth={screenWidth}
        startAfterMs={rainStartMs}
      />
      <PrivacyRainClusterSlot
        fadeDuration={fadeDuration}
        revealDuration={revealDuration}
        screenHeight={screenHeight}
        screenWidth={screenWidth}
        startAfterMs={rainStartMs + PRIVACY_RAIN_SLOT_STAGGER_MS}
      />
    </View>
  );
}

type BlockTxProps = {
  blockLeft: number;
  h: number;
  scanX: SharedValue<number>;
  w: number;
  x: number;
  y: number;
};

function BlockTx({ blockLeft, scanX, x, y, w, h }: BlockTxProps) {
  const style = useAnimatedStyle(() => {
    // localPastBlock = 0 when scan line reaches right edge of block
    const localPastBlock = scanX.value - (blockLeft + EXPLORER_BLOCK_SIZE - 20);
    const fadeIn = Math.min(
      1,
      Math.max(0, localPastBlock / EXPLORER_SCAN_FADE_IN_PX)
    );
    const fadeOut = Math.min(
      1,
      Math.max(
        0,
        (EXPLORER_SCAN_FADE_OUT_PX - localPastBlock) / EXPLORER_SCAN_FADE_OUT_PX
      )
    );
    const t = Math.min(fadeIn, fadeOut);
    return { opacity: 0.1 + t * 0.6 };
  });

  return (
    <Animated.View
      style={[
        styles.explorerTx,
        style,
        { height: h, left: x, top: y, width: w },
      ]}
    />
  );
}

type ExplorerStepProps = {
  screenHeight: number;
  screenWidth: number;
};

function ExplorerStep({ screenWidth, screenHeight }: ExplorerStepProps) {
  const revealOpacity = useSharedValue(0);
  const revealScale = useSharedValue(EXPLORER_REVEAL_SCALE);
  const scanX = useSharedValue(0);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: revealOpacity.value,
    transform: [{ scale: revealScale.value }],
  }));

  const scanStyle = useAnimatedStyle(() => {
    const fadeLeft = Math.min(1, scanX.value / EXPLORER_SCAN_EDGE_FADE_PX);
    const fadeRight = Math.min(
      1,
      (EXPLORER_CHAIN_WIDTH - scanX.value) / EXPLORER_SCAN_EDGE_FADE_PX
    );
    return {
      opacity: 0.8 * Math.min(fadeLeft, fadeRight),
      transform: [{ translateX: scanX.value }],
    };
  });

  const chainLeft = (screenWidth - EXPLORER_CHAIN_WIDTH) / 2;
  const chainTop = screenHeight * EXPLORER_TOP_FRACTION;

  useEffect(() => {
    revealOpacity.set(withTiming(1, { duration: EXPLORER_REVEAL_MS }));
    revealScale.set(
      withTiming(
        1,
        { duration: EXPLORER_REVEAL_MS, easing: Easing.out(Easing.cubic) },
        () => {
          scanX.set(
            withRepeat(
              withTiming(EXPLORER_CHAIN_WIDTH, {
                duration: EXPLORER_SCAN_MS,
                easing: Easing.linear,
              }),
              -1,
              false
            )
          );
        }
      )
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[styles.fullScreen, containerStyle]}
      pointerEvents="none"
    >
      <View style={[styles.explorerChain, { left: chainLeft, top: chainTop }]}>
        {Array.from({ length: EXPLORER_BLOCK_COUNT }).map((_, i) => {
          const blockLeft = i * (EXPLORER_BLOCK_SIZE + EXPLORER_CONNECTOR_W);
          const blockCenterScreen =
            chainLeft + blockLeft + EXPLORER_BLOCK_SIZE / 2;
          const edgeFadeLeft = Math.min(
            1,
            Math.max(0, blockCenterScreen / 120)
          );
          const edgeFadeRight = Math.min(
            1,
            Math.max(0, (screenWidth - blockCenterScreen) / 120)
          );
          const edgeFade = Math.max(
            0.32,
            Math.min(edgeFadeLeft, edgeFadeRight)
          );
          return (
            <View key={i} style={[styles.explorerItem, { opacity: edgeFade }]}>
              <View
                style={[
                  styles.explorerBlock,
                  i === Math.floor(EXPLORER_BLOCK_COUNT / 2) &&
                    styles.explorerBlockCenter,
                  Math.abs(i - Math.floor(EXPLORER_BLOCK_COUNT / 2)) === 1 &&
                    styles.explorerBlockNearCenter,
                ]}
              >
                {EXPLORER_TX_DEFS[i].map((tx, j) => (
                  <BlockTx
                    key={j}
                    blockLeft={blockLeft}
                    scanX={scanX}
                    x={tx.x}
                    y={tx.y}
                    w={tx.w}
                    h={tx.h}
                  />
                ))}
              </View>
              {i < EXPLORER_BLOCK_COUNT - 1 && (
                <View style={styles.explorerConnector} />
              )}
            </View>
          );
        })}
        <Animated.View style={[styles.explorerScan, scanStyle]} />
      </View>
    </Animated.View>
  );
}

type RoadmapItemProps = {
  done: boolean;
  index: number;
  uiReveal: SharedValue<number>;
};

function RoadmapItem({ done, index, uiReveal }: RoadmapItemProps) {
  const animStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, uiReveal.value - index));
    return {
      opacity: progress,
      transform: [{ translateY: ROADMAP_SLIDE_Y * (1 - progress) }],
    };
  });
  return (
    <Animated.View style={animStyle}>
      <View style={styles.roadmapRow}>
        <View style={[styles.roadmapDot, !done && styles.roadmapDotFuture]} />
        <View style={[styles.roadmapBar, !done && styles.roadmapBarFuture]} />
      </View>
    </Animated.View>
  );
}

type RoadmapStepProps = {
  screenHeight: number;
  screenWidth: number;
};

function RoadmapStep({ screenHeight, screenWidth }: RoadmapStepProps) {
  const uiReveal = useSharedValue(0);
  const lineH = useSharedValue(0);

  const lineStyle = useAnimatedStyle(() => ({ height: lineH.value }));

  const rowSpacing = screenHeight * ROADMAP_ROW_FRACTION;
  const totalLineH = (ROADMAP_ITEM_COUNT - 1) * rowSpacing;
  const totalDuration =
    ROADMAP_ITEM_COUNT * ROADMAP_STAGGER_MS + ROADMAP_FADE_MS;

  useEffect(() => {
    uiReveal.set(
      withTiming(ROADMAP_ITEM_COUNT, {
        duration: totalDuration,
        easing: Easing.linear,
      })
    );
    lineH.set(
      withTiming(totalLineH, {
        duration: totalDuration + 120,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startX = screenWidth * ROADMAP_LEFT_FRACTION;
  const startY = screenHeight * ROADMAP_TOP_FRACTION;

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      <View
        style={[
          styles.roadmapLineTrack,
          {
            left: startX + ROADMAP_DOT_SIZE / 2,
            top: startY + ROADMAP_DOT_SIZE / 2,
          },
        ]}
      >
        <Animated.View style={[styles.roadmapLineFill, lineStyle]} />
      </View>
      {ROADMAP_ITEMS.map((item, i) => (
        <View
          key={i}
          style={{
            left: startX,
            position: "absolute",
            top: startY + i * rowSpacing,
          }}
        >
          <RoadmapItem done={item.done} index={i} uiReveal={uiReveal} />
        </View>
      ))}
    </View>
  );
}

type ThanksNodeProps = {
  breathe: SharedValue<number>;
  finaleProgress: SharedValue<number>;
  index: number;
  nodeReveal: SharedValue<number>;
  screenHeight: number;
  screenWidth: number;
};

function ThanksNode({
  index,
  nodeReveal,
  breathe,
  finaleProgress,
  screenWidth,
  screenHeight,
}: ThanksNodeProps) {
  const node = THANKS_CONTRIBUTOR_NODES[index];
  const { size } = node;

  const animStyle = useAnimatedStyle(() => {
    const raw = Math.min(1, Math.max(0, nodeReveal.value - index));
    const progress = raw * raw * (3 - 2 * raw);
    return {
      opacity: node.opacity * progress * (1 - finaleProgress.value),
      transform: [{ scale: (0.5 + progress * 0.5) * breathe.value }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.thanksCircle,
        animStyle,
        {
          borderRadius: size / 2,
          height: size,
          left: node.cx * screenWidth - size / 2,
          overflow: "hidden",
          top: node.cy * screenHeight - size / 2,
          width: size,
        },
      ]}
    >
      <Image
        source={{ uri: `https://github.com/${node.github}.png?size=80` }}
        style={{ height: size, width: size }}
      />
    </Animated.View>
  );
}

type ThanksCompanyNodeProps = {
  breathe: SharedValue<number>;
  finaleProgress: SharedValue<number>;
  index: number;
  nodeReveal: SharedValue<number>;
  screenHeight: number;
  screenWidth: number;
};

function ThanksCompanyNode({
  index,
  nodeReveal,
  breathe,
  finaleProgress,
  screenWidth,
  screenHeight,
}: ThanksCompanyNodeProps) {
  const node = THANKS_COMPANY_NODES[index];
  const { size } = node;
  const nodeIndex = THANKS_CONTRIBUTOR_NODES.length + index;

  const animStyle = useAnimatedStyle(() => {
    const raw = Math.min(1, Math.max(0, nodeReveal.value - nodeIndex));
    const progress = raw * raw * (3 - 2 * raw);
    return {
      opacity: node.opacity * progress * (1 - finaleProgress.value),
      transform: [{ scale: (0.5 + progress * 0.5) * breathe.value }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.thanksCircle,
        animStyle,
        {
          borderRadius: size / 2,
          height: size,
          left: node.cx * screenWidth - size / 2,
          top: node.cy * screenHeight - size / 2,
          width: size,
        },
      ]}
    />
  );
}

type SaveSpendStepProps = {
  onPick: (choice: "save" | "spend") => void;
};

function SaveSpendStep({ onPick }: SaveSpendStepProps) {
  return (
    <View style={styles.fullScreen} pointerEvents="box-none">
      <View style={styles.saveSpendInner}>
        <SSButton
          label={t("intro.steps.saveSpend.optionSave")}
          onPress={() => onPick("save")}
          uppercase={false}
          variant="outline"
        />
        <SSButton
          label={t("intro.steps.saveSpend.optionSpend")}
          onPress={() => onPick("spend")}
          uppercase={false}
          variant="outline"
        />
      </View>
    </View>
  );
}

type SaveSpendFollowUpStepProps = {
  branch: "save" | "spend";
  onPick: () => void;
};

function SaveSpendFollowUpStep({
  branch,
  onPick,
}: SaveSpendFollowUpStepProps) {
  const primaryLabel =
    branch === "save"
      ? t("intro.steps.saveFollowup.optionCreateBitcoin")
      : t("intro.steps.spendFollowup.optionEcashWallet");
  const laterLabel =
    branch === "save"
      ? t("intro.steps.saveFollowup.optionLater")
      : t("intro.steps.spendFollowup.optionLater");

  return (
    <View style={styles.fullScreen} pointerEvents="box-none">
      <View style={styles.saveSpendInner}>
        <SSButton
          label={primaryLabel}
          onPress={onPick}
          uppercase={false}
          variant="outline"
        />
        <SSButton
          label={laterLabel}
          onPress={onPick}
          uppercase={false}
          variant="outline"
        />
      </View>
    </View>
  );
}

type ThanksStepProps = {
  finaleProgress: SharedValue<number>;
  screenHeight: number;
  screenWidth: number;
};

function ThanksStep({
  screenWidth,
  screenHeight,
  finaleProgress,
}: ThanksStepProps) {
  const logoReveal = useSharedValue(0);
  const nodeReveal = useSharedValue(0);
  const breathe = useSharedValue(1);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoReveal.value,
    transform: [
      {
        scale:
          (0.7 + logoReveal.value * 0.3) * (1 + finaleProgress.value * 0.06),
      },
    ],
  }));

  useEffect(() => {
    logoReveal.set(
      withTiming(
        1,
        {
          duration: THANKS_LOGO_REVEAL_MS,
          easing: Easing.out(Easing.back(1.2)),
        },
        () => {
          nodeReveal.set(
            withTiming(
              THANKS_TOTAL_NODE_COUNT,
              {
                duration:
                  THANKS_TOTAL_NODE_COUNT * THANKS_NODE_STAGGER_MS +
                  THANKS_NODE_REVEAL_MS,
                easing: Easing.linear,
              },
              () => {
                breathe.set(
                  withRepeat(
                    withTiming(THANKS_BREATHE_MAX, {
                      duration: THANKS_BREATHE_MS,
                      easing: Easing.inOut(Easing.sin),
                    }),
                    -1,
                    true
                  )
                );
              }
            )
          );
        }
      )
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const logoLeft = screenWidth / 2 - LOGO_SIZE / 2;
  const logoTop = screenHeight * 0.28 - LOGO_SIZE / 2;

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      {THANKS_CONTRIBUTOR_NODES.map((_, i) => (
        <ThanksNode
          key={i}
          index={i}
          nodeReveal={nodeReveal}
          breathe={breathe}
          finaleProgress={finaleProgress}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      ))}
      {THANKS_COMPANY_NODES.map((_, i) => (
        <ThanksCompanyNode
          key={`company-${i}`}
          index={i}
          nodeReveal={nodeReveal}
          breathe={breathe}
          finaleProgress={finaleProgress}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      ))}
      <Animated.View
        style={[
          styles.thanksLogoWrapper,
          logoStyle,
          { left: logoLeft, top: logoTop },
        ]}
      >
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>{"SAT\nSIGNER"}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

type SSIntroAnimationProps = {
  firstTime: boolean;
  onComplete: () => void;
};

function SSIntroAnimation({ firstTime, onComplete }: SSIntroAnimationProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { bottom: bottomInset } = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState(0);
  const [isLogoFinale, setIsLogoFinale] = useState(false);
  const [saveSpendChoice, setSaveSpendChoice] = useState<
    "save" | "spend" | null
  >(null);
  const stepSwitchingRef = useRef(false);

  const containerOpacity = useSharedValue(1);
  const circleScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const stepTransition = useSharedValue(0);
  const thanksFinaleProgress = useSharedValue(0);
  const stepOffsetX = useSharedValue(SLIDE_IN_OFFSET);
  const textSlideX = useSharedValue(SLIDE_IN_OFFSET);
  const descSlideX = useSharedValue(SLIDE_IN_OFFSET);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
  }));

  const stepTextStyle = useAnimatedStyle(() => ({
    opacity: stepTransition.value,
    transform: [{ translateX: textSlideX.value }],
  }));

  const descTextStyle = useAnimatedStyle(() => ({
    opacity: stepTransition.value,
    transform: [{ translateX: descSlideX.value }],
  }));

  const stepContentStyle = useAnimatedStyle(() => ({
    opacity: stepTransition.value,
    transform: [{ translateX: stepOffsetX.value }],
  }));

  useEffect(() => {
    if (firstTime) {
      stepOffsetX.set(
        withTiming(0, {
          duration: TRANSITION_MS,
          easing: Easing.out(Easing.quad),
        })
      );
      textSlideX.set(
        withDelay(
          TEXT_SLIDE_DELAY,
          withTiming(0, {
            duration: TRANSITION_MS,
            easing: Easing.out(Easing.quad),
          })
        )
      );
      descSlideX.set(
        withDelay(
          DESC_SLIDE_DELAY,
          withTiming(0, {
            duration: TRANSITION_MS,
            easing: Easing.out(Easing.quad),
          })
        )
      );
      stepTransition.set(withTiming(1, { duration: TRANSITION_MS }));
    } else {
      circleScale.set(
        withTiming(1, {
          duration: RETURNING_CIRCLE_IN,
          easing: Easing.out(Easing.back(1.3)),
        })
      );
      logoOpacity.set(
        withDelay(
          RETURNING_LOGO_DELAY,
          withTiming(1, { duration: RETURNING_LOGO_IN })
        )
      );
      containerOpacity.set(
        withDelay(
          RETURNING_FADE_DELAY,
          withTiming(0, { duration: RETURNING_FADE_OUT }, (finished) => {
            if (finished) {
              runOnJS(onComplete)();
            }
          })
        )
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fires after React commits the new step — guarantees the old step is
  // already unmounted before the fade-in starts, preventing ghost flashes.
  useEffect(() => {
    if (!stepSwitchingRef.current) {
      return;
    }
    stepSwitchingRef.current = false;
    stepOffsetX.set(
      withTiming(0, {
        duration: TRANSITION_MS,
        easing: Easing.out(Easing.quad),
      })
    );
    textSlideX.set(
      withDelay(
        TEXT_SLIDE_DELAY,
        withTiming(0, {
          duration: TRANSITION_MS,
          easing: Easing.out(Easing.quad),
        })
      )
    );
    descSlideX.set(
      withDelay(
        DESC_SLIDE_DELAY,
        withTiming(0, {
          duration: TRANSITION_MS,
          easing: Easing.out(Easing.quad),
        })
      )
    );
    stepTransition.set(withTiming(1, { duration: TRANSITION_MS }));
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  function startLogoFinale() {
    if (firstTime) {
      // Logo is already visible in ThanksStep — fade out UI, scale logo up, then exit
      stepTransition.set(withTiming(0, { duration: THANKS_FINALE_UI_FADE_MS }));
      thanksFinaleProgress.set(
        withDelay(
          150,
          withTiming(1, { duration: THANKS_FINALE_DURATION_MS }, () => {
            containerOpacity.set(
              withDelay(
                THANKS_FINALE_HOLD_MS,
                withTiming(
                  0,
                  { duration: THANKS_FINALE_OUT_MS },
                  (finished) => {
                    if (finished) {
                      runOnJS(onComplete)();
                    }
                  }
                )
              )
            );
          })
        )
      );
      return;
    }

    setIsLogoFinale(true);
    circleScale.set(
      withTiming(1, {
        duration: CIRCLE_IN_MS,
        easing: Easing.out(Easing.back(1.4)),
      })
    );
    logoOpacity.set(
      withDelay(
        CIRCLE_IN_MS - LOGO_OVERLAP_MS,
        withTiming(1, { duration: LOGO_IN_MS })
      )
    );
    containerOpacity.set(
      withDelay(
        CIRCLE_IN_MS + LOGO_IN_MS + LOGO_HOLD_MS,
        withTiming(0, { duration: FADE_OUT_MS }, (finished) => {
          if (finished) {
            runOnJS(onComplete)();
          }
        })
      )
    );
  }

  function advanceFromStep(step: number) {
    const next = step + 1;

    if (next >= STEP_COUNT) {
      startLogoFinale();
      return;
    }

    stepOffsetX.value = SLIDE_IN_OFFSET;
    textSlideX.value = SLIDE_IN_OFFSET;
    descSlideX.value = SLIDE_IN_OFFSET;
    stepSwitchingRef.current = true;
    setCurrentStep(next);
  }

  function goBackFromStep(step: number) {
    const prev = step - 1;
    stepOffsetX.value = SLIDE_OUT_OFFSET;
    textSlideX.value = SLIDE_OUT_OFFSET;
    descSlideX.value = SLIDE_OUT_OFFSET;
    stepSwitchingRef.current = true;
    if (step === 9) {
      setSaveSpendChoice(null);
    }
    setCurrentStep(prev);
  }

  function handleNext() {
    const step = currentStep;
    textSlideX.set(withTiming(SLIDE_OUT_OFFSET, { duration: TRANSITION_MS }));
    descSlideX.set(withTiming(SLIDE_OUT_OFFSET, { duration: TRANSITION_MS }));
    stepOffsetX.set(withTiming(SLIDE_OUT_OFFSET, { duration: TRANSITION_MS }));
    stepTransition.set(
      withTiming(0, { duration: TRANSITION_MS }, (finished) => {
        if (finished) {
          runOnJS(advanceFromStep)(step);
        }
      })
    );
  }

  function handleBack() {
    const step = currentStep;
    textSlideX.set(withTiming(SLIDE_IN_OFFSET, { duration: TRANSITION_MS }));
    descSlideX.set(withTiming(SLIDE_IN_OFFSET, { duration: TRANSITION_MS }));
    stepOffsetX.set(withTiming(SLIDE_IN_OFFSET, { duration: TRANSITION_MS }));
    stepTransition.set(
      withTiming(0, { duration: TRANSITION_MS }, (finished) => {
        if (finished) {
          runOnJS(goBackFromStep)(step);
        }
      })
    );
  }

  function handleSkip() {
    containerOpacity.value = 0;
    onComplete();
  }

  function handleSaveSpendPick(choice: "save" | "spend") {
    setSaveSpendChoice(choice);
    handleNext();
  }

  function handleSaveSpendFollowUpPick() {
    handleNext();
  }

  const isLastStep = currentStep === STEP_COUNT - 1;
  const stepCopyKeys = getIntroStepCopyKeys(currentStep, saveSpendChoice);
  const safeBottom = Math.max(bottomInset, MIN_BOTTOM_PADDING);

  return (
    <Animated.View style={[styles.overlay, containerStyle]}>
      {firstTime && !isLogoFinale && (
        <>
          {currentStep === 3 && <LayersStep stepTransition={stepTransition} />}
          <Animated.View
            style={[styles.fullScreen, stepContentStyle]}
            pointerEvents="box-none"
          >
            {currentStep === 0 && (
              <HexStreamStep screenHeight={screenHeight} />
            )}
            {currentStep === 1 && (
              <BubbleStep
                screenWidth={screenWidth}
                screenHeight={screenHeight}
              />
            )}
            {currentStep === 2 && (
              <SankeyStep screenHeight={screenHeight} />
            )}
            {currentStep === 4 && (
              <PrivacyStep
                screenWidth={screenWidth}
                screenHeight={screenHeight}
              />
            )}
            {currentStep === 5 && (
              <NostrStep
                screenWidth={screenWidth}
                screenHeight={screenHeight}
              />
            )}
            {currentStep === 6 && (
              <ExplorerStep
                screenWidth={screenWidth}
                screenHeight={screenHeight}
              />
            )}
            {currentStep === 7 && (
              <RoadmapStep
                screenWidth={screenWidth}
                screenHeight={screenHeight}
              />
            )}
            {currentStep === 8 && (
              <SaveSpendStep onPick={handleSaveSpendPick} />
            )}
            {currentStep === 9 && saveSpendChoice !== null && (
              <SaveSpendFollowUpStep
                branch={saveSpendChoice}
                onPick={handleSaveSpendFollowUpPick}
              />
            )}
            {currentStep === 10 && (
              <ThanksStep
                screenWidth={screenWidth}
                screenHeight={screenHeight}
                finaleProgress={thanksFinaleProgress}
              />
            )}

            <LinearGradient
              colors={["transparent", Colors.gray[950]]}
              style={styles.bottomGradient}
              pointerEvents="none"
            />
          </Animated.View>

          <View style={[styles.satsignerLabel, { bottom: safeBottom + 270 }]}>
            <Text style={styles.welcomeText}>SATSIGNER</Text>
          </View>

          <View style={[styles.titleBlock, { bottom: safeBottom + 172 }]}>
            <Animated.View style={stepTextStyle}>
              <SSText size="xl" style={styles.stepTitle}>
                {t(stepCopyKeys.titleKey)}
              </SSText>
            </Animated.View>
            <Animated.View style={descTextStyle}>
              <SSText color="muted" size="sm" style={styles.stepDescription}>
                {t(stepCopyKeys.descriptionKey)}
              </SSText>
            </Animated.View>
          </View>

          <View
            style={[styles.persistentButtons, { paddingBottom: safeBottom }]}
          >
            <View style={[styles.dots, styles.dotsSpaced]}>
              {Array.from({ length: STEP_COUNT }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === currentStep && styles.dotActive]}
                />
              ))}
            </View>
            {isLastStep ? (
              <View style={styles.bottomRow}>
                <View style={styles.sideButton}>
                  <SSButton
                    variant="outline"
                    label={t("intro.support")}
                    onPress={handleSkip}
                  />
                </View>
                <View style={styles.sideButton}>
                  <SSButton
                    variant="outline"
                    label={t("intro.finish")}
                    onPress={handleNext}
                  />
                </View>
              </View>
            ) : currentStep === 8 || currentStep === 9 ? (
              <View style={styles.saveSpendBottomSpacer} />
            ) : (
              <SSButton
                variant="secondary"
                label={t("common.next")}
                onPress={handleNext}
              />
            )}
            <View style={styles.bottomRow}>
              {currentStep > 0 && (
                <View style={styles.sideButton}>
                  <SSButton
                    variant="ghost"
                    label={t("common.back")}
                    onPress={handleBack}
                    uppercase={false}
                  />
                </View>
              )}
              {!isLastStep && (
                <View style={styles.sideButton}>
                  <SSButton
                    variant="ghost"
                    label={t("common.skip")}
                    onPress={handleSkip}
                    uppercase={false}
                  />
                </View>
              )}
            </View>
          </View>
        </>
      )}

      {!firstTime && (
        <Animated.View style={[styles.logoWrapper, circleStyle]}>
          <View style={styles.logoCircle}>
            <Animated.View style={logoStyle}>
              <Text style={styles.logoText}>{"SAT\nSIGNER"}</Text>
            </Animated.View>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bottomGradient: {
    bottom: 0,
    height: "55%",
    left: 0,
    position: "absolute",
    right: 0,
  },
  bottomRow: {
    flexDirection: "row",
    gap: 8,
  },
  bubble: {
    backgroundColor: Colors.white,
    position: "absolute",
  },
  dot: {
    backgroundColor: Colors.gray[600],
    borderRadius: DOT_SIZE / 2,
    height: DOT_SIZE,
    width: DOT_SIZE,
  },
  dotActive: {
    backgroundColor: Colors.white,
  },
  dots: {
    flexDirection: "row",
    gap: DOT_GAP,
    justifyContent: "center",
  },
  dotsSpaced: {
    marginBottom: 18,
  },
  explorerBlock: {
    borderColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    height: EXPLORER_BLOCK_SIZE,
    overflow: "hidden",
    width: EXPLORER_BLOCK_SIZE,
  },
  explorerBlockCenter: {
    borderColor: "rgba(255,255,255,0.65)",
  },
  explorerBlockNearCenter: {
    borderColor: "rgba(255,255,255,0.5)",
  },
  explorerChain: {
    alignItems: "center",
    flexDirection: "row",
    overflow: "hidden",
    position: "absolute",
  },
  explorerConnector: {
    backgroundColor: Colors.white,
    height: 1,
    opacity: 0.2,
    width: EXPLORER_CONNECTOR_W,
  },
  explorerItem: {
    alignItems: "center",
    flexDirection: "row",
  },
  explorerScan: {
    backgroundColor: Colors.white,
    bottom: 0,
    position: "absolute",
    top: 0,
    width: 1,
  },
  explorerTx: {
    backgroundColor: Colors.white,
    position: "absolute",
  },
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
  },
  hexClip: {
    bottom: 0,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    top: 0,
  },
  hexText: {
    fontFamily: Typography.sfProMono,
    fontSize: HEX_FONT_SIZE,
    left: HEX_LEFT_PADDING,
    lineHeight: HEX_LINE_HEIGHT,
    position: "absolute",
    right: HEX_LEFT_PADDING,
    textAlign: "center",
  },
  hexTextOverlayLine: {
    fontFamily: Typography.sfProMono,
    fontSize: HEX_FONT_SIZE,
    lineHeight: HEX_LINE_HEIGHT,
    textAlign: "center",
  },
  hexHlTint: {
    color: Colors.gray[600],
  },
  hexSectionLabel: {
    color: Colors.gray[875],
    left: HEX_LEFT_PADDING,
    position: "absolute",
    right: HEX_LEFT_PADDING,
  },
  logoCircle: {
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: LOGO_SIZE / 2,
    height: LOGO_SIZE,
    justifyContent: "center",
    width: LOGO_SIZE,
  },
  logoText: {
    color: Colors.black,
    fontFamily: Typography.sfProTextRegular,
    fontSize: LOGO_FONT_SIZE,
    letterSpacing: LOGO_LETTER_SPACING,
    lineHeight: LOGO_FONT_LINE_HEIGHT,
    textAlign: "center",
    textTransform: "uppercase",
  },
  logoWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  nostrNode: {
    backgroundColor: Colors.white,
    position: "absolute",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: Colors.gray[950],
    justifyContent: "center",
    zIndex: 9999,
  },
  persistentButtons: {
    bottom: 0,
    gap: 12,
    left: 0,
    paddingHorizontal: 24,
    position: "absolute",
    right: 0,
  },
  phoneBorder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.gray[950],
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: PHONE_FRAME_RADIUS,
    borderWidth: 1,
    gap: 10,
    overflow: "hidden",
    paddingHorizontal: 20,
    paddingTop: PHONE_HEADER_TOP,
  },
  phoneFrame: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.gray[950],
    borderRadius: PHONE_FRAME_RADIUS,
    elevation: 24,
    shadowColor: Colors.white,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0,
    shadowRadius: 32,
  },
  phoneLayerBtn: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.32)",
    borderRadius: 3,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
  },
  phoneLayerBtnBorder: {
    ...StyleSheet.absoluteFillObject,
    borderColor: Colors.white,
    borderRadius: 3,
    borderWidth: 1,
  },
  phoneLayerBtnText: {
    color: "rgba(255,255,255,0.82)",
    fontFamily: Typography.sfProTextLight,
    fontSize: 16,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  phoneUIElement: {
    alignSelf: "stretch",
  },
  ring: {
    borderColor: Colors.white,
    borderWidth: 1,
    position: "absolute",
  },
  privacyRainCluster: {
    ...StyleSheet.absoluteFillObject,
    overflow: "visible",
  },
  roadmapBar: {
    backgroundColor: Colors.white,
    borderRadius: 3,
    height: 7,
    opacity: 0.55,
    width: 110,
  },
  roadmapBarFuture: {
    opacity: 0.18,
  },
  roadmapDot: {
    backgroundColor: Colors.white,
    borderRadius: ROADMAP_DOT_SIZE / 2,
    height: ROADMAP_DOT_SIZE,
    opacity: 0.85,
    width: ROADMAP_DOT_SIZE,
  },
  roadmapDotFuture: {
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.4)",
    borderWidth: 1,
    opacity: 1,
  },
  roadmapLineFill: {
    backgroundColor: "rgba(255,255,255,0.25)",
    width: 1,
  },
  roadmapLineTrack: {
    overflow: "hidden",
    position: "absolute",
    width: 1,
  },
  roadmapRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  satsignerLabel: {
    left: 0,
    position: "absolute",
    right: 0,
  },
  saveSpendBottomSpacer: {
    minHeight: 52,
  },
  saveSpendInner: {
    alignItems: "stretch",
    flex: 1,
    gap: 16,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  sideButton: {
    flex: 1,
  },
  stepDescription: {
    lineHeight: 20,
    marginBottom: 12,
    textAlign: "center",
  },
  stepTitle: {
    fontFamily: Typography.sfProTextLight,
    textAlign: "center",
  },
  thanksCircle: {
    borderColor: Colors.white,
    borderWidth: 1,
    position: "absolute",
  },
  thanksLogoWrapper: {
    position: "absolute",
  },
  titleBlock: {
    gap: 8,
    left: 0,
    paddingHorizontal: 24,
    position: "absolute",
    right: 0,
  },
  welcomeText: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: Typography.sfProTextLight,
    fontSize: 11,
    letterSpacing: 3,
    textAlign: "center",
  },
});

export default SSIntroAnimation;
