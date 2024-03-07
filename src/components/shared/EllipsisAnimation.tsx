import { useEffect } from 'react';

import {
  View,
} from 'react-native';

import Animated, {
  useSharedValue,
  withRepeat,
  withDelay,
  withTiming,
  useAnimatedStyle
} from 'react-native-reanimated';

import { Colors } from '../../styles';

export function EllipsisAnimation(props: any) {
  const opacity1 = useSharedValue(0);
  const opacity2 = useSharedValue(0);
  const opacity3 = useSharedValue(0);
  
  const animatedStyles1 = useAnimatedStyle(() => {
    return {
      opacity: opacity1.value
    };
  });
  const animatedStyles2 = useAnimatedStyle(() => {
    return {
      opacity: opacity2.value
    };
  });
  const animatedStyles3 = useAnimatedStyle(() => {
    return {
      opacity: opacity3.value
    };
  });

  useEffect(() => {
    opacity1.value = withRepeat(withDelay(0, withTiming(1, {duration: 2250})), -1);
    opacity2.value = withRepeat(withDelay(750, withTiming(1, {duration: 1500})), -1);
    opacity3.value = withRepeat(withDelay(1500, withTiming(1, {duration: 750})), -1);
  }, []);

  const dotStyle = getStyles(
    props.size || 10,
    props.color || Colors.grey79
  );

  return (
    <View style={[
      props.style,
      { flexDirection: 'row', alignItems: 'center' }
    ]}>
      <Animated.View
        style={[dotStyle, animatedStyles1]}
      />
      <Animated.View
        style={[dotStyle, animatedStyles2]}
      />
      <Animated.View
        style={[dotStyle, animatedStyles3]}
      />
    </View>
  );
}

const getStyles = (size: number, color: string) => ({  
    width: size,
    height: size,
    borderRadius: Math.round(size / 2),
    marginRight: Math.round(size * 2),
    backgroundColor: color,
});
