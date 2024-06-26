import { ViewStyle } from "react-native"

import * as Colors from "./colors";

type Container = "base" | "topPadded" | "topPaddedThin" | "horizontalPadded" | "horizontalPaddedThin"
export const container: Record<Container, ViewStyle> = {
  base: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topPadded: {
    paddingTop: 30,
  },
  topPaddedThin: {
    paddingTop: 25,
  },
  horizontalPadded: {
    paddingHorizontal: '6%'
  },
  horizontalPaddedThin: {
    paddingHorizontal: '5%'
  }
};
