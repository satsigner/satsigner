import Slider from '@react-native-community/slider';
import React, {useDebugValue, useState} from 'react';
import {View, StyleSheet, Text} from 'react-native';
import GlobalStyles from '../../GlobalStyles';
import Button from '../shared/Button';
import Header from '../shared/Header';

interface Props {}

interface State {}

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