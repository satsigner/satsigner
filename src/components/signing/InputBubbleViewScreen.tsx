import React, {useDebugValue, useState} from 'react';
import {View, StyleSheet, Text} from 'react-native';
import {Layout, Typography} from '../../styles';
import Button from '../shared/Button';
import BubbleChart from './BubbleChart';
import * as Colors from '../../styles/colors';

interface Props {}

interface State {}

const InputBubbleViewScreen = () => {
  const [satsPerByte, setSatsPerByte] = useState(0);
  return (
    <View style={styles.body}>
      <View>
        <Text style={styles.numberOfOutputsText}>Spending X of Y outputs</Text>
        <View style={styles.amount}>
          <Text style={styles.satsAmountText}>14,476</Text>
          <Text style={styles.satsText}>sats</Text>
        </View>
        <Text style={styles.fiatAmountText}>26.34 USD</Text>
      </View>
      <View style={styles.bubbleChartContainer}>
        <BubbleChart
          width={600}
          height={400}
          data={getData()}
        />
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
  );
};

export default InputBubbleViewScreen;

const styles = StyleSheet.create({
  amount: {
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  body: {
    ...Layout.container.base,
    paddingHorizontal: '5%',
    justifyContent: 'space-evenly',
  },
  estimatedBlocksText: {
    ...Typography.textHighlight.x5,
  },
  feeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  feeText: {
    color: 'white',
    letterSpacing: 1,
    fontSize: 13,
  },
  feeFiatText: {
    letterSpacing: 1,
    fontSize: 13,
    color: '#575757',
  },
  fiatAmountText: {
    color: 'white',
    letterSpacing: 1,
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
    ...Typography.textHighlight.x5,
    alignSelf: 'center',
    marginBottom: 7,
    marginTop: 10,
  },
  satsAmountText: {
    color: 'white',
    fontSize: 45,
    fontWeight: '300',
    textAlign: 'right',
    letterSpacing: 0.6,
  },
  satsPerByteText: {
    color: 'white',
    letterSpacing: 1,
    fontSize: 13,
  },
  satsText: {
    letterSpacing: 1,
    color: '#575757',
    fontSize: 18,
  },
  signMessageButton: {
    color: 'black',
    backgroundColor: 'white',
  },
  signMessageButtonText: {
    color: 'black',
  },
  bubbleChartContainer: {
    alignItems: 'center',
    height: 400
  }
});

function getData(): any[] {
  const inputValues = [  4101, 9351, 4101, 5101, 841, 6351, 4101, 4101, 10351, 9351, 5101 ];
  return inputValues.map(inputValue => ({
    name: `${inputValue} sats`,
    color: Colors.white,
    value: inputValue
  }));
}