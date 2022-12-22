import { ViewStyle } from "react-native"

import * as Colors from "./colors";

type Container = "base" | "topPadded" | "horizontalPadded"
export const container: Record<Container, ViewStyle> = {
  base: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topPadded: {
    paddingTop: 30,
  },
  horizontalPadded: {
    paddingHorizontal: '6%'
  },
};
