// Adapted from https://github.com/akshit5230/React-Native-Bubble-Chart

import React from 'react';
import {
  View,
} from 'react-native';
import * as d3 from 'd3';
import Svg, {
  Circle,
  G,
  Text as SVGText,
} from 'react-native-svg';

export default class BubbleChart extends React.Component {

  render() {

    const {
      height,
      width,
      data,
      textProps,
      circleProps
    } = this.props;

    let pack = data => d3.pack()
      .size([width - 2, height - 2])
      .padding(3)
      (d3.hierarchy({ children: data })
        .sum(d => d.value))

    const root = pack(data);

    let fontSizeGenerator = (value) => {
      let size = 0
      if (value < 10) {
        size = 2
      } else if(value >= 10 && value < 50) {
        size = 6
      } else {
        size = 15
      }
      return size
    }

    let leaves = []
    let key = 0;
    for (let leaf of root.leaves()) {
      leaves.push(
        <G transform={`translate(${leaf.x + 1},${leaf.y + 1})`} key={key++}>
          <Circle
            {...circleProps}
            r={leaf.r}
            fill={leaf.data.color}
            onPress={() => console.log('pressed')}
          />
          <SVGText
            {...textProps}
            fill="black"
            fontSize={fontSizeGenerator(leaf.data.value)}
            x="0"
            y={leaf.data.value * 0.001}
            textAnchor="middle" >{leaf.data.name}</SVGText>
        </G>
      )
    }

    return (
      <View style={styles.container}>
        <Svg width={width || 400} height={height || 300}>
          {leaves}
        </Svg>
      </View>
    )
  }

}

const styles = {
  container: {
    flex: 1,
  }
}