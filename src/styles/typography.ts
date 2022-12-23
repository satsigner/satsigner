import { TextStyle } from "react-native";

import * as Colors from "./colors";

type Capitalization = "uppercase" | "lowercase" | "capitalize"
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

type FontSize = "x1" | "x2" | "x3" | "x4" | "x5" | "x6" | "x7" | "x8" | "x9" | "x10" | "x11" | "x12" | "x20" | "x30" | "x40"
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

// TODO implement corrent font family
// TODO consider use of letter spacing (e.g. letterSpacing: 1)

type TextNormal = "x1" | "x2" | "x3" | "x4" | "x5" | "x6" | "x7" | "x8" | "x9" | "x10" | "x11" | "x12" | "x20" | "x30" | "x40"
export const textNormal: Record<TextNormal, TextStyle> = {
  x1: {
    ...fontSize.x1,
    color: Colors.grey130
  },
  x2: {
    ...fontSize.x2,
    color: Colors.grey130
  },
  x3: {
    ...fontSize.x3,
    color: Colors.grey130
  },
  x4: {
    ...fontSize.x4,
    color: Colors.grey130
  },
  x5: {
    ...fontSize.x5,
    color: Colors.grey130
  },
  x6: {
    ...fontSize.x6,
    color: Colors.grey130
  },
  x7: {
    ...fontSize.x7,
    color: Colors.grey130
  },
  x8: {
    ...fontSize.x8,
    color: Colors.grey130
  },
  x9: {
    ...fontSize.x9,
    color: Colors.grey130
  },
  x10: {
    ...fontSize.x10,
    color: Colors.grey130
  },
  x11: {
    ...fontSize.x11,
    color: Colors.grey130
  },
  x12: {
    ...fontSize.x12,
    color: Colors.grey130
  },
  x20: {
    ...fontSize.x20,
    color: Colors.grey130
  },
  x30: {
    ...fontSize.x30,
    color: Colors.grey130
  },
  x40: {
    ...fontSize.x40,
    color: Colors.grey130
  }
};

type TextHighlight = "x1" | "x2" | "x3" | "x4" | "x5" | "x6" | "x7" | "x8" | "x9" | "x10" | "x11" | "x12" | "x20" | "x30" | "x40"
export const textHighlight: Record<TextHighlight, TextStyle> = {
  x1: {
    ...fontSize.x1,
    color: Colors.white
  },
  x2: {
    ...fontSize.x2,
    color: Colors.white
  },
  x3: {
    ...fontSize.x3,
    color: Colors.white
  },
  x4: {
    ...fontSize.x4,
    color: Colors.white
  },
  x5: {
    ...fontSize.x5,
    color: Colors.white
  },
  x6: {
    ...fontSize.x6,
    color: Colors.white
  },
  x7: {
    ...fontSize.x7,
    color: Colors.white
  },
  x8: {
    ...fontSize.x8,
    color: Colors.white
  },
  x9: {
    ...fontSize.x9,
    color: Colors.white
  },
  x10: {
    ...fontSize.x10,
    color: Colors.white
  },
  x11: {
    ...fontSize.x11,
    color: Colors.white
  },
  x12: {
    ...fontSize.x12,
    color: Colors.white
  },
  x20: {
    ...fontSize.x20,
    color: Colors.white
  },
  x30: {
    ...fontSize.x30,
    color: Colors.white
  },
  x40: {
    ...fontSize.x40,
    color: Colors.white
  }
};

type TextMuted = "x1" | "x2" | "x3" | "x4" | "x5" | "x6" | "x7" | "x8" | "x9" | "x10" | "x11" | "x12" | "x20" | "x30" | "x40"
export const textMuted: Record<TextMuted, TextStyle> = {
  x1: {
    ...fontSize.x1,
    color: Colors.white,
    opacity: 0.15
  },
  x2: {
    ...fontSize.x2,
    color: Colors.white,
    opacity: 0.15
  },
  x3: {
    ...fontSize.x3,
    color: Colors.white,
    opacity: 0.15
  },
  x4: {
    ...fontSize.x4,
    color: Colors.white,
    opacity: 0.15
  },
  x5: {
    ...fontSize.x5,
    color: Colors.white,
    opacity: 0.15
  },
  x6: {
    ...fontSize.x6,
    color: Colors.white,
    opacity: 0.15
  },
  x7: {
    ...fontSize.x7,
    color: Colors.white,
    opacity: 0.15
  },
  x8: {
    ...fontSize.x8,
    color: Colors.white,
    opacity: 0.15
  },
  x9: {
    ...fontSize.x9,
    color: Colors.white,
    opacity: 0.15
  },
  x10: {
    ...fontSize.x10,
    color: Colors.white,
    opacity: 0.15
  },
  x11: {
    ...fontSize.x11,
    color: Colors.white,
    opacity: 0.15
  },
  x12: {
    ...fontSize.x12,
    color: Colors.white,
    opacity: 0.15
  },
  x20: {
    ...fontSize.x20,
    color: Colors.white,
    opacity: 0.15
  },
  x30: {
    ...fontSize.x30,
    color: Colors.white,
    opacity: 0.15
  },
  x40: {
    ...fontSize.x40,
    color: Colors.white,
    opacity: 0.15
  }
};
