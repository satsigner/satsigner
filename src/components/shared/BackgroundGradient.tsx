import { PropsWithChildren } from 'react';
import {
  StyleProp,
  ViewStyle
} from 'react-native';

import { Colors } from '../../styles';

import LinearGradient from 'react-native-linear-gradient';

interface Props {
  style: StyleProp<ViewStyle>;
}

export default function BackgroundGradient({
  style,
  children
}: PropsWithChildren<Props>) {

  return (
    <LinearGradient
      style={style}
      colors={[Colors.grey24, Colors.grey34]}
      // TODO consider left to right gradient instead of angled
      //   so gradient starting at top of screen content
      //   can blend into the header gradient
      start={{
        x: 0.94,
        y: 1.0
      }}
      end={{
        x: 0.86,
        y: -0.64
      }}
    >
      { children }
    </LinearGradient>
  );
}
