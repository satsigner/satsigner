import { TextStyle } from "react-native";

import * as Colors from "./colors";

type Capitalization = "uppercase" | "lowercase" | "capitalize";
export const capitalization: Record<Capitalization, TextStyle> = {
  uppercase: {
    textTransform: 'uppercase'
  },
  lowercase: {
    textTransform: 'lowercase'
  },
  capitalize: {
    textTransform: 'capitalize'
  }
};

type FontSize = "x1" | "x2" | "x3" | "x4" | "x5" | "x6" | "x7" | "x8" | "x9" | "x10" | "x11" | "x12" | "x14" | "x16" | "x18" | "x20" | "x30" | "x40";
export const fontSize: Record<FontSize, TextStyle> = {
  x1: {
    fontSize: 9
  },
  x2: {
    fontSize: 10
  },
  x3: {
    fontSize: 11
  },
  x4: {
    fontSize: 12
  },
  x5: {
    fontSize: 13
  },
  x6: {
    fontSize: 14
  },
  x7: {
    fontSize: 15
  },
  x8: {
    fontSize: 16
  },
  x9: {
    fontSize: 17
  },
  x10: {
    fontSize: 18
  },
  x11: {
    fontSize: 19
  },
  x12: {
    fontSize: 20
  },
  x14: {
    fontSize: 22
  },
  x16: {
    fontSize: 23
  },
  x18: {
    fontSize: 24
  },
  x20: {
    fontSize: 26
  },
  x30: {
    fontSize: 35
  },
  x40: {
    fontSize: 46
  }
};

// TODO implement correct font family
// TODO consider use of letter spacing (e.g. letterSpacing: 1)

type TextNormal = "x1" | "x2" | "x3" | "x4" | "x5" | "x6" | "x7" | "x8" | "x9" | "x10" | "x11" | "x12" | "x14" | "x16" | "x18" | "x20" | "x30" | "x40";
export const textNormal: Record<TextNormal, TextStyle> = {
  x1: {
    ...fontSize.x1,
    color: Colors.normal
  },
  x2: {
    ...fontSize.x2,
    color: Colors.normal
  },
  x3: {
    ...fontSize.x3,
    color: Colors.normal
  },
  x4: {
    ...fontSize.x4,
    color: Colors.normal
  },
  x5: {
    ...fontSize.x5,
    color: Colors.normal
  },
  x6: {
    ...fontSize.x6,
    color: Colors.normal
  },
  x7: {
    ...fontSize.x7,
    color: Colors.normal
  },
  x8: {
    ...fontSize.x8,
    color: Colors.normal
  },
  x9: {
    ...fontSize.x9,
    color: Colors.normal
  },
  x10: {
    ...fontSize.x10,
    color: Colors.normal
  },
  x11: {
    ...fontSize.x11,
    color: Colors.normal
  },
  x12: {
    ...fontSize.x12,
    color: Colors.normal
  },
  x14: {
    ...fontSize.x14,
    color: Colors.normal
  },
  x16: {
    ...fontSize.x16,
    color: Colors.normal
  },
  x18: {
    ...fontSize.x18,
    color: Colors.normal
  },
  x20: {
    ...fontSize.x20,
    color: Colors.normal
  },
  x30: {
    ...fontSize.x30,
    color: Colors.normal
  },
  x40: {
    ...fontSize.x40,
    color: Colors.normal
  }
};

type TextHighlight = "x1" | "x2" | "x3" | "x4" | "x5" | "x6" | "x7" | "x8" | "x9" | "x10" | "x11" | "x12" | "x14" | "x16" | "x18" | "x20" | "x30" | "x40";
export const textHighlight: Record<TextHighlight, TextStyle> = {
  x1: {
    ...fontSize.x1,
    color: Colors.highlight
  },
  x2: {
    ...fontSize.x2,
    color: Colors.highlight
  },
  x3: {
    ...fontSize.x3,
    color: Colors.highlight
  },
  x4: {
    ...fontSize.x4,
    color: Colors.highlight
  },
  x5: {
    ...fontSize.x5,
    color: Colors.highlight
  },
  x6: {
    ...fontSize.x6,
    color: Colors.highlight
  },
  x7: {
    ...fontSize.x7,
    color: Colors.highlight
  },
  x8: {
    ...fontSize.x8,
    color: Colors.highlight
  },
  x9: {
    ...fontSize.x9,
    color: Colors.highlight
  },
  x10: {
    ...fontSize.x10,
    color: Colors.highlight
  },
  x11: {
    ...fontSize.x11,
    color: Colors.highlight
  },
  x12: {
    ...fontSize.x12,
    color: Colors.highlight
  },
  x14: {
    ...fontSize.x14,
    color: Colors.highlight
  },
  x16: {
    ...fontSize.x16,
    color: Colors.highlight
  },
  x18: {
    ...fontSize.x18,
    color: Colors.highlight
  },
  x20: {
    ...fontSize.x20,
    color: Colors.highlight
  },
  x30: {
    ...fontSize.x30,
    color: Colors.highlight
  },
  x40: {
    ...fontSize.x40,
    color: Colors.highlight
  }
};

type TextMuted = "x1" | "x2" | "x3" | "x4" | "x5" | "x6" | "x7" | "x8" | "x9" | "x10" | "x11" | "x12" | "x14" | "x16" | "x18" | "x20" | "x30" | "x40";
export const textMuted: Record<TextMuted, TextStyle> = {
  x1: {
    ...fontSize.x1,
    color: Colors.muted,
  },
  x2: {
    ...fontSize.x2,
    color: Colors.muted,
  },
  x3: {
    ...fontSize.x3,
    color: Colors.muted,
  },
  x4: {
    ...fontSize.x4,
    color: Colors.muted,
  },
  x5: {
    ...fontSize.x5,
    color: Colors.muted,
  },
  x6: {
    ...fontSize.x6,
    color: Colors.muted,
  },
  x7: {
    ...fontSize.x7,
    color: Colors.muted,
  },
  x8: {
    ...fontSize.x8,
    color: Colors.muted,
  },
  x9: {
    ...fontSize.x9,
    color: Colors.muted,
  },
  x10: {
    ...fontSize.x10,
    color: Colors.muted,
  },
  x11: {
    ...fontSize.x11,
    color: Colors.muted,
  },
  x12: {
    ...fontSize.x12,
    color: Colors.muted,
  },
  x14: {
    ...fontSize.x14,
    color: Colors.muted,
  },
  x16: {
    ...fontSize.x16,
    color: Colors.muted,
  },
  x18: {
    ...fontSize.x18,
    color: Colors.muted,
  },
  x20: {
    ...fontSize.x20,
    color: Colors.muted,
  },
  x30: {
    ...fontSize.x30,
    color: Colors.muted,
  },
  x40: {
    ...fontSize.x40,
    color: Colors.muted,
  }
};

// Fonts

// Adding new fonts:
// 1. add fonts to src/assets/fonts
// 2. run `npx react-native-asset`
//
// https://developer.mozilla.org/en-US/docs/Web/CSS/font-weight#common_weight_name_mapping
//
// Value   Common weight name
// 100     Thin (Hairline)
// 200     Extra Light (Ultra Light)
// 300     Light
// 400     Normal (Regular)
// 500     Medium
// 600     Semi Bold (Demi Bold)
// 700     Bold
// 800     Extra Bold (Ultra Bold)
// 900     Black (Heavy)
// 950     Extra Black (Ultra Black)

// SF Pro
// fonts available for download at https://developer.apple.com/fonts/

// mapping:
// 100 = SF Pro Thin
// 200 = SF Pro Ultra Light
// 300 = SF Pro Light
// 400 = SF Pro Regular
// 500 = SF Pro Medium
// 600 = SF Pro Semi-bold
// 700 = SF Pro Bold
// 800 = SF Pro Heavy
// 900 = SF Pro Black

type FontFamily =
  'sfProDisplayRegular' |
  'sfProDisplayMedium' |
  'sfProTextUltraLight' |
  'sfProTextLight' |
  'sfProTextRegular' |
  'sfProTextBold'
export const fontFamily: Record<FontFamily, TextStyle> = {
  sfProDisplayRegular: { // 400
    fontFamily: 'SF-Pro-Display-Regular'
  },
  sfProDisplayMedium: { // 500
    fontFamily: 'SF-Pro-Display-Medium'
  },
  sfProTextUltraLight: { // 200
    fontFamily: 'SF-Pro-Text-Ultralight'
  },
  sfProTextLight: { // 300
    fontFamily: 'SF-Pro-Text-Light'
  },
  sfProTextRegular: { // 400
    fontFamily: 'SF-Pro-Text-Regular'
  },
  sfProTextBold: { // 700
    fontFamily: 'SF-Pro-Text-Bold'
  },
};
