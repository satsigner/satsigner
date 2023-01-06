import Slider from '@react-native-community/slider';
import React, {useDebugValue, useState} from 'react';
import {View, StyleSheet, Text} from 'react-native';
import GlobalStyles from '../../GlobalStyles';
import {Layout, Typography} from '../../styles';
import Button from '../shared/Button';
import Header from '../shared/Header';
import TransactionSankey from './TransactionSankey';

interface Props {}

interface State {}

const InputHistoryExplorer = () => {
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
      <View>
        <TransactionSankey
          data={data}
          width="375"
          height="225">
        </TransactionSankey>
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
    ...Typography.textHighlight.x5,
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

const data = {
  "nodes": [
    {
      "name": "Input 1",
      "type": "input",
      "value": 0.01500000
    },
    {
      "name": "Input 2",
      "type": "input",
      "value": 0.01500000
    },
    {
      "name": "Transaction",
      "type": "transaction"
    },
    {
      "name": "Output 1",
      "type": "output",
      "value": 0.01500000
    },
    {
      "name": "Change",
      "type": "output",
      "value": 0.01500000
    },
    {
      "name": "Mining Fee",
      "type": "output",
      "value": 0.01500000
    }
  ],
  "links": [
    {
      "source": 0,
      "target": 2,
      "value": 0.01500000
    },
    {
      "source": 1,
      "target": 2,
      "value": 0.00420000
    },
    {
      "source": 2,
      "target": 3,
      "value": 0.01000000
    },
    {
      "source": 2,
      "target": 4,
      "value": 0.009165
    },
    {
      "source": 2,
      "target": 5,
      "value": 0.00003500
    }
  ]
};
