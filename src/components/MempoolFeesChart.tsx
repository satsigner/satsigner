import React from 'react';
import {View} from 'react-native';
import {
  Text,
  VictoryArea,
  VictoryAxis,
  VictoryChart,
  VictoryStack,
  VictoryTheme,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from 'victory-native';

interface Props {
  data: {}[];
}

interface State {
  data: any[];
  limitFee: number;
  limitFilterFee: number;
  height: number | string;
  top: number | string;
  right: number | string;
  left: number | string;
  template: 'widget' | 'advanced';
  showZoom: boolean;
  windowPreferenceOverride: string;
}

function objectify(array: number[][]) {
  var objectified = [{}];
  array.forEach(function (element) {
    objectified.push({x: element[0], y: element[1]});
  });
  return objectified;
}

export class MempoolGraphComponent extends React.PureComponent<Props, State> {
  isLoading = true;
  mempoolVsizeFeesData: any;
  mempoolVsizeFeesOptions: any; // EChartsOption;
  mempoolVsizeFeesInitOptions = {
    renderer: 'svg',
  };
  windowPreference: string = '';
  hoverIndexSerie = 0;
  feeLimitIndex: number = 10;
  feeLevelsOrdered: string[] = [];
  //   chartColorsOrdered = chartColors;
  inverted: boolean = false;
  chartInstance: any = undefined;

  constructor(props: Props) {
    super(props);

    this.state = {
      data: [],
      limitFee: 350,
      limitFilterFee: 1,
      height: 200,
      top: 20,
      right: 10,
      left: 75,
      template: 'widget',
      showZoom: true,
      windowPreferenceOverride: '',
    };
  }

  unpackMempoolDataset(mempoolStats: number[][][]) {
    let mempoolStatsSet = [];
    for (let i = 0; i < mempoolStats.length; i++) {
      const feeRange = objectify(mempoolStats[i]).slice(2);
      mempoolStatsSet.push(feeRange);
    }
    return mempoolStatsSet;
  }

  handleNewMempoolData(mempoolStats: any[]) {
    const labels = mempoolStats.map(stats => stats.added);
    const finalArrayVByte = this.generateArray(mempoolStats);

    return {
      labels: labels,
      series: finalArrayVByte,
    };
  }

  generateArray(mempoolStats: any[]) {
    const finalArray: number[][][] = [];
    let feesArray: number[][] = [];
    const limitFeesTemplate = 20;
    for (let i = limitFeesTemplate; i > -1; i--) {
      feesArray = [];
      mempoolStats.forEach(stats => {
        feesArray.push([
          stats.added * 1000,
          stats.vsizes[i] ? stats.vsizes[i] : 0,
        ]);
      });
      finalArray.push(feesArray);
    }
    finalArray.reverse();
    return finalArray;
  }

  render() {
    if (!this.props.data) {
      return (
        <View>
          <Text>Loading...</Text>
        </View>
      );
    }

    const mempoolParsedData = this.handleNewMempoolData(
      this.props.data.concat([]),
    );
    const graphReadyData = this.unpackMempoolDataset(mempoolParsedData.series);

    return (
      <VictoryChart
        theme={VictoryTheme.material}
        height={300}
        containerComponent={<VictoryVoronoiContainer />}
        width={380}>
        <VictoryStack height={200}>
          {graphReadyData.map((value, index) => {
            const rgbCol = 222 - 15 * index;
            return (
              <VictoryArea
                style={{
                  data: {
                    fill: `rgb(${rgbCol}, ${rgbCol}, ${rgbCol})`, // '#FF7300',
                    // stroke: '#FF5E00',
                    strokeWidth: 2,
                  },
                }}
                data={
                  value as {
                    x: number;
                    y: number;
                  }[]
                }
                labelComponent={
                  <VictoryTooltip
                    renderInPortal={false}
                    style={{fill: '#FF7300'}}
                  />
                }
              />
            );
          })}
        </VictoryStack>
        <VictoryAxis
          fixLabelOverlap={true}
          // tickValues={}
          style={{
            axis: {stroke: 'transparent'},
            grid: {stroke: 'transparent'},
            tickLabels: {
              fontSize: 12,
              paddingLeft: 10,
            },
          }}
        />
        <VictoryAxis
          dependentAxis
          tickValues={[0, 10, 20, 30]}
          orientation="left"
          style={{
            tickLabels: {fontSize: 12},
            axis: {stroke: 'transparent'},
          }}
        />
      </VictoryChart>
    );
  }
}
