import React, {FC} from 'react';
import {StyleSheet, SafeAreaView, View, Text} from 'react-native';

import Animated, {
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {G, Line, Path, Svg} from 'react-native-svg';
import {mixPath, ReText, parse, Path as RePath} from 'react-native-redash';
import ButtonSection from './ButtonSection';
import {GraphData} from './InputHistortyExplorer';

type LineChartProps = {
  height: number;
  width: number;
  data: GraphData[];
  leftPadding: number;
  bottomPadding: number;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

const LineChart: FC<LineChartProps> = ({
  height,
  width,
  data,
  bottomPadding,
  leftPadding,
}) => {
  const selectedGraph = useSharedValue(data[0]);
  const previousGraph = useSharedValue({...data[0]});
  const isAnimationComplete = useSharedValue(true);
  const transition = useSharedValue(1);

  const onQuarterTapped = (quarter: number) => {
    if (isAnimationComplete.value) {
      isAnimationComplete.value = false;
      transition.value = 0;
      selectedGraph.value = data[quarter - 1];

      transition.value = withTiming(1, {}, () => {
        previousGraph.value = selectedGraph.value;
        isAnimationComplete.value = true;
      });
    }
  };

  const animatedProps = useAnimatedProps(() => {
    return {
      d: mixPath(
        transition.value,
        previousGraph.value.curve,
        selectedGraph.value.curve,
      ),
    };
  });

  const mostRecent = useDerivedValue(() => {
    return `$${selectedGraph.value.mostRecent}`;
  });

  const q1Tapped = () => onQuarterTapped(1);
  const q2Tapped = () => onQuarterTapped(2);
  const q3Tapped = () => onQuarterTapped(3);
  const q4Tapped = () => onQuarterTapped(4);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.titleText}>FACEBOOK</Text>
        <ReText style={styles.priceText} text={mostRecent} />
      </View>
      <Animated.View style={styles.chartContainer}>
        <Svg width={width} height={height} stroke="#6231ff">
          <G y={-bottomPadding}>
            <Line
              x1={leftPadding}
              y1={height}
              x2={width}
              y2={height}
              stroke={'#d7d7d7'}
              strokeWidth="1"
            />
            <Line
              x1={leftPadding}
              y1={height * 0.6}
              x2={width}
              y2={height * 0.6}
              stroke={'#d7d7d7'}
              strokeWidth="1"
            />
            <Line
              x1={leftPadding}
              y1={height * 0.2}
              x2={width}
              y2={height * 0.2}
              stroke={'#d7d7d7'}
              strokeWidth="1"
            />
            <AnimatedPath animatedProps={animatedProps} strokeWidth="2" />
          </G>
        </Svg>
      </Animated.View>
      <ButtonSection
        q1Tapped={q1Tapped}
        q2Tapped={q2Tapped}
        q3Tapped={q3Tapped}
        q4Tapped={q4Tapped}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
    marginHorizontal: 30,
  },
  titleText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    color: 'black',
  },
  priceText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default LineChart;
