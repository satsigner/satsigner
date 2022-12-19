import Slider from '@react-native-community/slider';
import React, {useState} from 'react';
import {View, StyleSheet, Text, Dimensions} from 'react-native';
import GlobalStyles from '../../GlobalStyles';
import Button from '../shared/Button';
import Header from '../shared/Header';
import {curveBasis, line, scaleLinear, scaleTime} from 'd3';
import {
  animatedData,
  animatedData2,
  animatedData3,
  DataPoint,
  originalData,
} from './Data';
import {parse, Path as RePath} from 'react-native-redash';
import LineChart from './LineChart';

interface Props {}

interface State {}

export type GraphData = {
  max: number;
  min: number;
  curve: RePath;
  mostRecent: number;
};

const {width} = Dimensions.get('screen');

const CARD_WIDTH = width - 20;
const GRAPH_WIDTH = CARD_WIDTH - 60;
const CARD_HEIGHT = 325;
const GRAPH_HEIGHT = 200;

const makeGraph = (data: DataPoint[]) => {
  const max = Math.max(...data.map(val => val.value));
  const min = Math.min(...data.map(val => val.value));
  const y = scaleLinear().domain([0, max]).range([GRAPH_HEIGHT, 35]);

  const x = scaleTime()
    .domain([new Date(2000, 1, 1), new Date(2000, 1, 15)])
    .range([10, GRAPH_WIDTH - 10]);

  const curvedLine = line<DataPoint>()
    .x(d => x(new Date(d.date)))
    .y(d => y(d.value))
    .curve(curveBasis)(data);

  return {
    max,
    min,
    curve: parse(curvedLine!),
    mostRecent: data[data.length - 1].value,
  };
};

const graphData: GraphData[] = [
  makeGraph(originalData),
  makeGraph(animatedData),
  makeGraph(animatedData2),
  makeGraph(animatedData3),
];

const InputHistoryExplorer = () => {
  const [satsPerByte, setSatsPerByte] = useState(0);

  return (
    <View style={styles.container}>
      <Header heading="Extra Security"></Header>
      <View style={styles.body}>
        <View>
          <Text style={styles.numberOfOutputsText}>
            Spending X of Y outputs
          </Text>
          <View style={styles.amount}>
            <Text style={styles.satsAmountText}>14,476</Text>
            <Text style={styles.satsText}>sats</Text>
          </View>
          <Text style={styles.fiatAmountText}>26.34 USD</Text>
        </View>
        <View style={{flex: 0.9}}>
          <LineChart
            height={GRAPH_HEIGHT}
            width={GRAPH_WIDTH}
            data={graphData}
            bottomPadding={20}
            leftPadding={0}
          />
        </View>
        <View>
          <Slider
            value={satsPerByte}
            onValueChange={setSatsPerByte}
            step={0.01}
            minimumValue={1}
            maximumValue={1000}
            minimumTrackTintColor={'white'}
          />
          <View style={styles.feeContainer}>
            <View>
              <Text style={styles.feeText}>1503 sats</Text>
              <Text style={styles.feeFiatText}>0.44 USD</Text>
            </View>
            <Text style={styles.estimatedBlocksText}>~4 blocks</Text>
            <Text style={styles.satsPerByteText}>
              {satsPerByte.toFixed(2)} sat/vB
            </Text>
          </View>
        </View>
        <View>
          <View style={styles.inOutButtonsContainer}>
            <Button
              style={styles.inOutButton}
              textStyle={styles.inOutButtonText}
              title={'Add Input'}
              onPress={() => {}}
            />
            <Button
              style={styles.inOutButton}
              textStyle={styles.inOutButtonText}
              title={'Add Output'}
              onPress={() => {}}
            />
          </View>
          <Button
            style={styles.signMessageButton}
            textStyle={styles.signMessageButtonText}
            title={'Sign Message'}
            onPress={() => {}}
          />
        </View>
      </View>
    </View>
  );
};

export default InputHistoryExplorer;

const styles = StyleSheet.create({
  amount: {
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  body: {
    flex: 1,
    marginHorizontal: '5%',
    justifyContent: 'space-evenly',
  },
  container: {
    flex: 1,
  },
  estimatedBlocksText: {
    ...GlobalStyles.text,
  },
  feeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  feeText: {
    ...GlobalStyles.text,
  },
  feeFiatText: {
    ...GlobalStyles.text,
    color: '#575757',
  },
  fiatAmountText: {
    ...GlobalStyles.text,
    alignSelf: 'center',
    fontSize: 11,
  },
  inOutButton: {
    backgroundColor: '#131313',
    borderColor: 'white',
    borderWidth: 2,
    maxWidth: '50%',
    marginHorizontal: 5,
    flexGrow: 1,
  },
  inOutButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  inOutButtonText: {
    color: 'white',
  },
  numberOfOutputsText: {
    ...GlobalStyles.text,
    alignSelf: 'center',
    marginBottom: 7,
    marginTop: 10,
  },
  satsAmountText: {
    ...GlobalStyles.text,
    fontSize: 45,
    fontWeight: '300',
    textAlign: 'right',
    letterSpacing: 0.6,
  },
  satsPerByteText: {
    ...GlobalStyles.text,
  },
  satsText: {
    ...GlobalStyles.text,
    color: '#575757',
    fontSize: 18,
  },
  signMessageButton: {
    ...GlobalStyles.button,
    backgroundColor: 'white',
  },
  signMessageButtonText: {
    color: 'black',
  },
});
