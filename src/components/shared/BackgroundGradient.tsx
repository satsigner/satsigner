import { PropsWithChildren } from 'react';
import {
  StyleProp,
  ViewStyle
} from 'react-native';

import { Colors } from '../../styles';

import LinearGradient from 'react-native-linear-gradient';

interface Props {
  style?: StyleProp<ViewStyle>;
  orientation: 'horizontal' | 'diagonal';
}

export default function BackgroundGradient({
  style,
  orientation = 'diagonal',
  children
}: PropsWithChildren<Props>) {
  
  const start = orientation === 'diagonal' ?
    { x: 0.94, y: 1.0 } :
    { x: 0.86, y: 1.0 };

  const end = orientation === 'diagonal' ?
    { x: 0.86, y: -0.64 } :
    { x: 0.14, y: 1.0 };

  return (
    <LinearGradient
      style={style}
      colors={[Colors.grey24, Colors.grey34]}
      start={start}
      end={end}
    >
      { children }
    </LinearGradient>
  );
}
