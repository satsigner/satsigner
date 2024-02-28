// Adapted from https://github.com/akshit5230/React-Native-Bubble-Chart

import React from 'react';
import { View, Animated, Dimensions } from 'react-native';
import * as d3 from 'd3';
import Svg, { Circle, G, Text } from 'react-native-svg';

export default class BubbleChart extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      pressedIndex: null,
      opacities: props.data.map(() => new Animated.Value(1)),
    };
  }

  handlePress = (index) => {
    const { pressedIndex, opacities } = this.state;
    const newOpacities = opacities.map((opacity, i) => {
      if (pressedIndex === index) {
        return Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        });
      } else if (i === index) {
        return Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        });
      } else {
        return Animated.timing(opacity, {
          toValue: 0.3,
          duration: 300,
          useNativeDriver: true,
        });
      }
    });

    Animated.parallel(newOpacities).start();
    this.setState({ pressedIndex: pressedIndex === index ? null : index });
  };

  render() {
    const {
      height,
      width,
      data,
      circleProps
    } = this.props;
    const {
      pressedIndex,
      opacities
    } = this.state;

    let pack = data =>
      d3.pack()
        .size([width - 2, height - 2])
        .padding(3)(
          d3.hierarchy({ children: data }).sum(d => d.value)
        );

    const root = pack(data);

    // const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    const leaves = root.leaves().map((leaf, i) => {

      let fontSizeGenerator = (value, scale) => {
        let size = 0;
        if (value < 6) {
          size = pressedIndex === i ? 1 : 2;
        } else if (value >= 10 && value < 1000) {
          size = pressedIndex === i ? 3.5 : 5;
        } else {
          size = pressedIndex === i ? 10 : 12;
        }
        return size
      }


      const scale = pressedIndex === i ? Math.min(width, height) / leaf.r / 3 : 1;
      // const pressedIndexFontSize = pressedIndex === i ? Math.min(width, height) / leaf.r * 3 : 12;

      return {
        index: i,
        component: (
          <AnimatedG
            key={i}
            opacity={opacities[i]}
            transform={`translate(${leaf.x + 1},${leaf.y + 1}) scale(${scale})`}
            // width={screenWidth * 2.8}
            // height= {screenHeight * 2.6}
            onPress={() => this.handlePress(i)}
          >
            <Circle {...circleProps}
              r={leaf.r}
              fill={leaf.data.color}
            />
            {pressedIndex === i &&
              <Text
                fill="black"
                fontSize={fontSizeGenerator(leaf.data.value, scale)}
                x="0"
                y={leaf.data.value * 0.001 - leaf.r / 3}
                textAnchor="middle"
              >
                {leaf.data.date}
              </Text>}

            <Text
              fill="black"
              fontSize={fontSizeGenerator(leaf.data.value, scale)}
              x="0"
              y={leaf.data.value * 0.001}
              textAnchor="middle"
            >
              {leaf.data.name}
            </Text>

            {pressedIndex === i &&
              <Text
                fill="black"
                fontSize={fontSizeGenerator(leaf.data.value, scale)}
                x="0"
                y={leaf.data.value * 0.001 + leaf.r / 3}
                textAnchor="middle"
              >
              {leaf.data.memo.length > 12 ? `${leaf.data.memo.slice(0, 12)}...` : leaf.data.memo}
              </Text>}
          </AnimatedG>
        ),
      };
    });

    leaves.sort((a, b) => {
      if (a.index === pressedIndex) return 1;
      if (b.index === pressedIndex) return -1;
      return 0;
    });

    let centeringTranslation = [0, 0];
    if (pressedIndex !== null) {
      const pressedLeaf = root.leaves()[pressedIndex];
      centeringTranslation = [(width / 2) - pressedLeaf.x, (height / 2) - pressedLeaf.y];
    }

    return (
      <View style={styles.container}>
        <Svg
          width={width || 400}
          height={height || 300}
        >
          <G transform={`translate(${centeringTranslation[0]}, ${centeringTranslation[1]})`}>
            {leaves.map((leaf) => leaf.component)}
          </G>
        </Svg>
      </View>
    )
  }
}

const AnimatedG = Animated.createAnimatedComponent(G);

const styles = {
  container: {
    flex: 1,
  }
}